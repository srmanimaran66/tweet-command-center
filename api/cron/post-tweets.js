import { getKv } from '../../lib/kv.js';
import { getValidAccessToken, postTweet, QUEUE_TTL } from '../../lib/x-auth.js';

export default async function handler(req, res) {
  // Vercel sends Authorization: Bearer CRON_SECRET on cron invocations.
  // Skip the check if CRON_SECRET is not set (local dev / manual trigger).
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const kv = await getKv();
  const queueKeys = await kv.keys('queue:*');
  const now = Date.now();
  let totalPosted = 0;
  let totalErrors = 0;

  for (const queueKey of queueKeys) {
    const sessionId = queueKey.replace('queue:', '');
    const queue = (await kv.get(queueKey)) || [];

    const due = queue.filter(t => !t.posted && new Date(t.scheduledAt).getTime() <= now);
    if (due.length === 0) continue;

    const accessToken = await getValidAccessToken(kv, sessionId);
    if (!accessToken) {
      console.warn(`[cron] No valid token for session ${sessionId.slice(0, 8)}…`);
      continue;
    }

    // Post in ascending scheduled order
    for (const tweet of due.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))) {
      const { ok, data } = await postTweet(accessToken, tweet.text);
      if (ok) {
        tweet.posted = true;
        tweet.postedAt = new Date().toISOString();
        tweet.xTweetId = data.data?.id;
        totalPosted++;
      } else {
        console.error(`[cron] Failed to post tweet ${tweet.id}:`, JSON.stringify(data));
        totalErrors++;
      }
    }

    await kv.setex(queueKey, QUEUE_TTL, queue);
  }

  console.log(`[cron] done — posted: ${totalPosted}, errors: ${totalErrors}`);
  res.json({ posted: totalPosted, errors: totalErrors });
}
