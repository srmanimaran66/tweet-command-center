import { getSessionId, revokeToken } from '../../../lib/x-auth.js';
import { getKv } from '../../../lib/kv.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sessionId = getSessionId(req);
  if (sessionId) {
    const kv = await getKv();
    const stored = await kv.get(`tokens:${sessionId}`);
    if (stored?.access_token) await revokeToken(stored.access_token);
    await kv.del(`tokens:${sessionId}`);
  }

  res.setHeader('Set-Cookie', 'x_session=; Path=/; Max-Age=0');
  res.json({ ok: true });
}
