import crypto from 'crypto';
import { generatePkce } from '../../../lib/x-auth.js';
import { getKv } from '../../../lib/kv.js';

export default async function handler(req, res) {
  if (!process.env.X_CLIENT_ID) {
    return res.status(503).json({
      error: 'X OAuth not configured — set X_CLIENT_ID, X_CLIENT_SECRET, X_CALLBACK_URL.',
    });
  }

  const { verifier, challenge } = generatePkce();
  const state = crypto.randomBytes(16).toString('hex');

  const kv = await getKv();
  await kv.setex(`pkce:${state}`, 300, verifier);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.X_CLIENT_ID,
    redirect_uri: process.env.X_CALLBACK_URL,
    scope: 'tweet.read tweet.write users.read offline.access',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  res.redirect(302, `https://twitter.com/i/oauth2/authorize?${params}`);
}
