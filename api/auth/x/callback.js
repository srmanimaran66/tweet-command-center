import crypto from 'crypto';
import { exchangeCode, sessionCookieHeader, TOKEN_TTL } from '../../../lib/x-auth.js';
import { getKv } from '../../../lib/kv.js';

export default async function handler(req, res) {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(302, `/?xError=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return res.redirect(302, '/?xError=missing_params');
  }

  const kv = await getKv();
  const verifier = await kv.get(`pkce:${state}`);
  if (!verifier) {
    return res.redirect(302, '/?xError=invalid_state');
  }
  await kv.del(`pkce:${state}`);

  const tokens = await exchangeCode(code, verifier);
  if (tokens.error) {
    const msg = encodeURIComponent(tokens.error_description || tokens.error);
    return res.redirect(302, `/?xError=${msg}`);
  }

  const sessionId = crypto.randomBytes(32).toString('hex');
  await kv.setex(`tokens:${sessionId}`, TOKEN_TTL, {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + (tokens.expires_in || 7200) * 1000,
  });

  res.setHeader('Set-Cookie', sessionCookieHeader(sessionId, TOKEN_TTL));
  res.redirect(302, '/');
}
