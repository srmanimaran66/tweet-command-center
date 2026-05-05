# External Integrations

**Analysis Date:** 2026-05-05

## APIs & External Services

**AI / LLM:**
- Anthropic Claude API — generates all tweet content; handles self-improvement passes, spike upgrades, and completion repairs
  - SDK/Client: Native `fetch` (no SDK), calling `https://api.anthropic.com/v1/messages`
  - Model: `claude-sonnet-4-6` (hardcoded in both `server.js` and `api/messages.js`)
  - Max tokens ceiling: 16,000 (capped server-side to prevent abuse)
  - Auth: `ANTHROPIC_API_KEY` env var, sent as `x-api-key` header with `anthropic-version: 2023-06-01`
  - Proxy: All browser calls go to `/api/messages` (backend proxies to Anthropic — key never exposed to browser)

**Social Media:**
- X (Twitter) API v2 — posts scheduled tweets; handles OAuth 2.0 PKCE auth flow
  - Endpoints used:
    - `https://twitter.com/i/oauth2/authorize` — authorization redirect
    - `https://api.twitter.com/2/oauth2/token` — token exchange and refresh
    - `https://api.twitter.com/2/oauth2/revoke` — token revocation on disconnect
    - `https://api.twitter.com/2/tweets` — posting tweets (Bearer token)
  - SDK/Client: Native `fetch`, implemented in `lib/x-auth.js`
  - Auth: OAuth 2.0 with PKCE (`S256` challenge method); scopes: `tweet.write users.read offline.access`
  - Credentials: `X_CLIENT_ID`, `X_CLIENT_SECRET`, `X_CALLBACK_URL` env vars
  - Token storage: Upstash Redis keyed by session ID (`tokens:{sessionId}`), TTL 30 days
  - Refresh: Automatic token refresh in `lib/x-auth.js:getValidAccessToken` when token expires within 5 minutes

## Data Storage

**Databases:**
- Upstash Redis — persists OAuth tokens and tweet queues for X scheduling
  - Connection: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (also accepts legacy `KV_REST_API_URL` + `KV_REST_API_TOKEN`)
  - Client: `@upstash/redis` v1.37.0, dynamically imported in `lib/kv.js`
  - Key schema:
    - `pkce:{state}` — PKCE verifier during OAuth flow (TTL: 300 seconds)
    - `tokens:{sessionId}` — X OAuth access + refresh tokens (TTL: 30 days)
    - `queue:{sessionId}` — scheduled tweet queue array (TTL: 14 days)
  - Local dev fallback: in-memory `Map` with manual TTL via `setTimeout` (same interface, no Redis needed locally)

**File Storage:**
- Local filesystem only — no cloud file storage integration

**Caching:**
- Browser `localStorage` — persists user profile (`tweetfull_profile`) and previous week's tweets (`tweetfull_previous_week`) client-side; TTL for previous week is 14 days enforced in JS
- Upstash Redis doubles as a cache for session tokens (see above)

## Authentication & Identity

**Auth Provider:**
- X OAuth 2.0 with PKCE — custom implementation, no third-party auth library
  - Flow: `GET /api/auth/x/connect` → X authorization page → `GET /api/auth/x/callback` → session cookie
  - Session: Random 64-char hex `sessionId` stored in `HttpOnly; SameSite=Lax; Secure` cookie (`x_session`)
  - Implementation: `lib/x-auth.js`, `api/auth/x/connect.js`, `api/auth/x/callback.js`, `api/auth/x/status.js`, `api/auth/x/disconnect.js`

**Internal API Auth:**
- Shared token (`API_TOKEN` / `VITE_API_TOKEN`) — frontend sends `x-app-token` header with every `/api/messages` request; backend validates it server-side
- Vercel Cron auth: `CRON_SECRET` env var; Vercel sends `Authorization: Bearer {CRON_SECRET}` on cron invocations; checked in `api/cron/post-tweets.js`

## Monitoring & Observability

**Error Tracking:**
- None — no Sentry, Datadog, or equivalent integration detected

**Logs:**
- `console.log` / `console.error` / `console.warn` used throughout `api/` and `lib/`; visible in Vercel function logs in production

## CI/CD & Deployment

**Hosting:**
- Vercel — static frontend + serverless API functions + cron jobs
- Config: `vercel.json` defines build command (`npm run build`), output directory (`dist`), SPA rewrite, and cron schedule

**CI Pipeline:**
- None detected — no GitHub Actions, CircleCI, or similar config files found

## Environment Configuration

**Required env vars (production):**
- `ANTHROPIC_API_KEY` — Anthropic API access
- `API_TOKEN` — internal proxy auth secret
- `VITE_API_TOKEN` — same value as `API_TOKEN`, exposed to Vite bundle
- `ALLOWED_ORIGIN` — CORS allowed origin (e.g., `https://your-app.vercel.app`)
- `X_CLIENT_ID` — X app client ID (required for X scheduling features)
- `X_CLIENT_SECRET` — X app client secret
- `X_CALLBACK_URL` — OAuth redirect URI (e.g., `https://your-app.vercel.app/api/auth/x/callback`)
- `UPSTASH_REDIS_REST_URL` — Upstash Redis endpoint
- `UPSTASH_REDIS_REST_TOKEN` — Upstash Redis auth token
- `CRON_SECRET` — Vercel cron job authorization secret

**Secrets location:**
- Vercel project dashboard → Environment Variables (production)
- `.env` file locally (not committed; `.env.example` documents all vars)

## Webhooks & Callbacks

**Incoming:**
- `GET /api/auth/x/callback` — OAuth 2.0 redirect callback from X after user authorizes; handles PKCE code exchange, stores tokens, sets session cookie
- `GET /api/cron/post-tweets` — called hourly by Vercel Cron; processes due tweets from all user queues and posts them to X

**Outgoing:**
- None — no outgoing webhooks to external services

---

*Integration audit: 2026-05-05*
