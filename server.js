import express from 'express';
import cors from 'cors';
import connectHandler from './api/auth/x/connect.js';
import callbackHandler from './api/auth/x/callback.js';
import statusHandler from './api/auth/x/status.js';
import disconnectHandler from './api/auth/x/disconnect.js';
import pushHandler from './api/schedule/push.js';
import scheduleStatusHandler from './api/schedule/status.js';
import cronHandler from './api/cron/post-tweets.js';

const app = express();

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: '64kb' }));

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const API_TOKEN = process.env.API_TOKEN;

if (!ANTHROPIC_API_KEY) {
  console.error('\n❌ Missing ANTHROPIC_API_KEY environment variable!');
  console.error('Copy .env.example to .env and fill in the values.\n');
  process.exit(1);
}

if (!API_TOKEN) {
  console.error('\n❌ Missing API_TOKEN environment variable!');
  console.error('Copy .env.example to .env and fill in the values.\n');
  process.exit(1);
}

const ALLOWED_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS_CEILING = 16000;

app.post('/api/messages', (req, res, next) => {
  if (req.headers['x-app-token'] !== API_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}, async (req, res) => {
  const { messages, max_tokens, system } = req.body;

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
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── X OAuth + scheduling routes ─────────────────────────────────────────────
app.get('/api/auth/x/connect', connectHandler);
app.get('/api/auth/x/callback', callbackHandler);
app.get('/api/auth/x/status', statusHandler);
app.post('/api/auth/x/disconnect', disconnectHandler);
app.post('/api/schedule/push', pushHandler);
app.get('/api/schedule/status', scheduleStatusHandler);
// Manual cron trigger for local testing: GET http://localhost:PORT/api/cron/post-tweets
app.get('/api/cron/post-tweets', cronHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n✅ Proxy server running on http://localhost:${PORT}`);
  console.log('   Frontend can now make API calls!\n');
  if (process.env.X_CLIENT_ID) {
    console.log('   X OAuth enabled — connect at /api/auth/x/connect\n');
  }
});
