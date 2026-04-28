import { getSessionId } from '../../lib/x-auth.js';
import { getKv } from '../../lib/kv.js';

export default async function handler(req, res) {
  const sessionId = getSessionId(req);
  if (!sessionId) return res.json({ queued: 0, posted: 0, pending: 0, tweets: [] });

  const kv = await getKv();
  const queue = (await kv.get(`queue:${sessionId}`)) || [];

  res.json({
    queued: queue.length,
    posted: queue.filter(t => t.posted).length,
    pending: queue.filter(t => !t.posted).length,
    tweets: queue,
  });
}
