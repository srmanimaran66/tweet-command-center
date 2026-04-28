import { getSessionId, QUEUE_TTL } from '../../lib/x-auth.js';
import { getKv } from '../../lib/kv.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sessionId = getSessionId(req);
  if (!sessionId) return res.status(401).json({ error: 'Not connected to X' });

  const kv = await getKv();
  const stored = await kv.get(`tokens:${sessionId}`);
  if (!stored) return res.status(401).json({ error: 'X session expired — reconnect' });

  const { tweets } = req.body || {};
  if (!Array.isArray(tweets) || tweets.length === 0) {
    return res.status(400).json({ error: 'tweets array required' });
  }

  const incoming = tweets.map(t => ({
    id: t.id,
    text: t.fullText,
    scheduledAt: t.scheduledAt,
    displayTime: t.displayTime,
    dayNumber: t.dayNumber,
    posted: false,
    sessionId,
  }));

  const existing = (await kv.get(`queue:${sessionId}`)) || [];
  const incomingIds = new Set(incoming.map(t => t.id));
  const merged = [...existing.filter(t => !incomingIds.has(t.id)), ...incoming];

  await kv.setex(`queue:${sessionId}`, QUEUE_TTL, merged);

  res.json({ queued: incoming.length, total: merged.length });
}
