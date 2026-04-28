import { getSessionId } from '../../../lib/x-auth.js';
import { getKv } from '../../../lib/kv.js';

export default async function handler(req, res) {
  const sessionId = getSessionId(req);
  if (!sessionId) return res.json({ connected: false });

  const kv = await getKv();
  const tokens = await kv.get(`tokens:${sessionId}`);
  res.json({ connected: !!tokens });
}
