import { getSessionId, getValidAccessToken, postTweet, QUEUE_TTL } from '../../lib/x-auth.js';
import { getKv } from '../../lib/kv.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sessionId = getSessionId(req);
  if (!sessionId) return res.status(401).json({ error: 'Not connected to X' });

  const kv = await getKv();
  const accessToken = await getValidAccessToken(kv, sessionId);
  if (!accessToken) return res.status(401).json({ error: 'X session expired — reconnect' });

  const { id, text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text required' });

  const { ok, data } = await postTweet(accessToken, text);
  if (!ok) return res.status(502).json({ error: data?.detail || data?.title || 'X API error', data });

  const xTweetId = data.data?.id;

  // Mark as posted in the queue if the tweet was scheduled there
  if (id) {
    const queue = (await kv.get(`queue:${sessionId}`)) || [];
    const entry = queue.find(t => t.id === id);
    if (entry) {
      entry.posted = true;
      entry.postedAt = new Date().toISOString();
      entry.xTweetId = xTweetId;
      await kv.setex(`queue:${sessionId}`, QUEUE_TTL, queue);
    }
  }

  res.json({ ok: true, xTweetId });
}
