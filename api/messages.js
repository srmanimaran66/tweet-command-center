const ALLOWED_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS_CEILING = 16000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const appToken = process.env.API_TOKEN;
  if (appToken && req.headers['x-app-token'] !== appToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const origin = req.headers.origin || req.headers.referer || '';
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  if (allowedOrigin && !origin.startsWith(allowedOrigin)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { messages, max_tokens, system } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Invalid request: messages array required' });
  }

  const cappedTokens = Math.min(Number(max_tokens) || 8000, MAX_TOKENS_CEILING);

  const payload = {
    model: ALLOWED_MODEL,
    max_tokens: cappedTokens,
    messages,
    ...(system ? { system } : {}),
  };

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Anthropic API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
