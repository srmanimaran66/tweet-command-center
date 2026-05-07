import crypto from 'crypto';

// ─── PKCE ────────────────────────────────────────────────────────────────────

export function generatePkce() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

// ─── Token exchange ───────────────────────────────────────────────────────────

function basicAuth() {
  return Buffer.from(
    `${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`
  ).toString('base64');
}

export async function exchangeCode(code, codeVerifier) {
  const res = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth()}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.X_CALLBACK_URL,
      code_verifier: codeVerifier,
    }),
  });
  return res.json();
}

export async function refreshTokens(refreshToken) {
  const res = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth()}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  return res.json();
}

export async function revokeToken(accessToken) {
  await fetch('https://api.twitter.com/2/oauth2/revoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth()}`,
    },
    body: new URLSearchParams({ token: accessToken, token_type_hint: 'access_token' }),
  }).catch(() => {});
}

// ─── Posting ──────────────────────────────────────────────────────────────────

export async function postTweet(accessToken, text) {
  const res = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ text }),
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

export function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || '').split(';').flatMap(c => {
      const [k, ...v] = c.trim().split('=');
      return k ? [[k.trim(), decodeURIComponent(v.join('='))]] : [];
    })
  );
}

export function getSessionId(req) {
  return parseCookies(req)['x_session'] || null;
}

export function sessionCookieHeader(sessionId, maxAge = 30 * 24 * 3600) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `x_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

// ─── KV helpers ───────────────────────────────────────────────────────────────

export const TOKEN_TTL = 30 * 24 * 3600;  // 30 days
export const QUEUE_TTL = 14 * 24 * 3600;  // 14 days

export async function getValidAccessToken(kv, sessionId) {
  const stored = await kv.get(`tokens:${sessionId}`);
  if (!stored) return null;

  if (stored.expires_at > Date.now() + 5 * 60 * 1000) {
    return stored.access_token;
  }

  const refreshed = await refreshTokens(stored.refresh_token).catch(() => null);
  if (!refreshed?.access_token) return null;

  await kv.setex(`tokens:${sessionId}`, TOKEN_TTL, {
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token || stored.refresh_token,
    expires_at: Date.now() + (refreshed.expires_in || 7200) * 1000,
  });
  return refreshed.access_token;
}
