# Architecture

**Analysis Date:** 2026-05-05

## Pattern Overview

**Overall:** Dual-runtime SPA + Serverless API Proxy

**Key Characteristics:**
- React SPA owns all UI state; no router — view transitions are driven by a single `view` enum in `App.jsx`
- A local Express server (`server.js`) or Vercel serverless functions (`api/`) act as an authenticated proxy between the browser and external services (Anthropic API, X/Twitter API)
- The browser never holds API keys; all secrets remain server-side
- All tweet state lives in React component state (`useState`) and is persisted to `localStorage` for cross-session continuity
- X OAuth tokens and the tweet posting queue are stored in Upstash Redis (production) or an in-memory Map (local dev)

## Layers

**UI / View Layer:**
- Purpose: Render the four application screens and surface all user interactions
- Location: `src/components/`
- Contains: `SetupForm.jsx`, `WeeklyPlanner.jsx`, `TweetCard.jsx`, `TweetEditor.jsx`, `ScheduleReview.jsx`
- Depends on: App state passed as props, `src/lib/scheduler.js` for date formatting
- Used by: `src/App.jsx` (orchestrator)

**Application Orchestrator:**
- Purpose: Hold all runtime state, run the multi-step generation pipeline, dispatch mutations
- Location: `src/App.jsx`
- Contains: `generateWeek` pipeline (two-pass improvement loop), `handleRegenerate`, tweet CRUD handlers, localStorage read/write
- Depends on: All `src/lib/*` modules, all UI components
- Used by: `src/main.jsx` (React root)

**Client-Side Domain Library:**
- Purpose: Stateless pure functions for AI interaction, content scoring, scheduling, and prompt construction
- Location: `src/lib/`
- Contains: `ai.js`, `prompts.js`, `scoring.js`, `ctas.js`, `scheduler.js`, `trends.js`, `templates.js`
- Depends on: Nothing outside `src/lib/` (fully self-contained)
- Used by: `src/App.jsx`

**API Proxy / Serverless Layer:**
- Purpose: Authenticate requests, forward to external APIs, manage OAuth flow and tweet queue
- Location: `api/` (Vercel serverless functions), `server.js` (local Express equivalent)
- Contains: `api/messages.js` (implicit in `server.js`), `api/auth/x/connect.js`, `api/auth/x/callback.js`, `api/auth/x/status.js`, `api/auth/x/disconnect.js`, `api/schedule/push.js`, `api/schedule/status.js`, `api/cron/post-tweets.js`
- Depends on: `lib/kv.js`, `lib/x-auth.js`
- Used by: Browser fetch calls from `src/lib/ai.js` and `src/components/ScheduleReview.jsx`

**Server-Side Shared Library:**
- Purpose: KV store abstraction and X OAuth/token utilities used by all API handlers
- Location: `lib/`
- Contains: `lib/kv.js` (Upstash Redis vs in-memory Map), `lib/x-auth.js` (PKCE, token exchange, refresh, posting, cookie helpers)
- Depends on: `@upstash/redis` (dynamically imported when env vars present), `crypto` (Node built-in)
- Used by: All handlers in `api/`

## Data Flow

**Week Generation Pipeline (primary flow):**

1. User fills `SetupForm.jsx` and submits; `App.jsx#generateWeek` is called with a `profile` object
2. `getTrendsForProfile(profile)` scores `MOCK_TRENDS` by keyword match and returns top 7
3. `buildGenerateWeekPrompt(profile, trends, previousWeekTweets)` constructs a structured prompt string
4. `callClaude(prompt, { maxTokens: 12000 })` POSTs to `/api/messages`; `server.js` validates the `x-app-token` header, caps tokens, and forwards to `https://api.anthropic.com/v1/messages`
5. Response is parsed with `parseJSON`, normalized, and passed through `applyCtasToTweets` (strips AI-hallucinated CTAs, appends pool-drawn CTA metadata)
6. `scoreAllTweets(tweets, profile)` assigns a 0-100 score to each tweet
7. **Pass 1 improvement:** tweets with `score < 65` get `buildSelfImprovementPrompt`; tweets with `score > 85` get `buildSpikeUpgradePrompt`; structurally defective tweets get `buildCompletionPrompt`. Each runs a separate `callClaude` call in parallel via `Promise.all`
8. **Pass 2 improvement:** Remaining defective or low-scoring tweets get a second sequential fix attempt
9. `assignSchedule(tweets, startDate, timeZone)` attaches ISO timestamps and display times (Mon–Fri, 3 slots/day)
10. Final tweet array is stored in React state and saved to `localStorage` via `savePreviousWeek`

**X OAuth Flow:**

1. `ScheduleReview.jsx` calls `GET /api/auth/x/status` to check connection
2. If not connected, user is directed to `GET /api/auth/x/connect` which generates a PKCE pair, stores verifier in KV (`pkce:<state>` key, 5-min TTL), and redirects to Twitter's OAuth authorize URL
3. Twitter redirects to `GET /api/auth/x/callback` with `code` and `state`; handler validates state against KV, exchanges code for tokens, stores tokens in KV (`tokens:<sessionId>`, 30-day TTL), and sets an `x_session` cookie
4. `POST /api/schedule/push` reads the session cookie, loads the token from KV, and stores the tweet queue (`queue:<sessionId>`, 14-day TTL)
5. `GET /api/cron/post-tweets` runs hourly (Vercel cron); iterates all `queue:*` keys, refreshes expired tokens automatically, posts due tweets via `postTweet`, and marks them `posted: true`

**State Management:**
- Runtime state: `useState` in `src/App.jsx` (tweets array, profile, view, isGenerating, error flags)
- Cross-session persistence: `localStorage` keys `tweetfull_profile` (versioned) and `tweetfull_previous_week` (versioned, 14-day TTL checked at load time)
- Server-side state: Upstash Redis keys `tokens:<sessionId>`, `queue:<sessionId>`, `pkce:<state>`

## Key Abstractions

**Tweet Object:**
- Purpose: Core domain entity flowing through the entire pipeline
- Fields: `id`, `dayNumber` (1-5), `tweetOrder` (1-3), `tweetType` (`primary_educational` | `secondary_educational` | `engagement`), `templateName`, `fullText`, `hookText`, `bodyText`, `ctaText`, `score`, `scoreBreakdown`, `scheduledAt`, `displayTime`, `timeZone`, `status` (`draft` | `approved`), `defective`, `skeleton`
- Skeleton tweets (no `fullText`) are rendered while generation is in progress

**KV Abstraction (`lib/kv.js`):**
- Purpose: Single interface for key-value storage that works in both environments
- Pattern: `getKv()` returns either a real `@upstash/redis` client (when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set) or an in-memory `Map`-backed `localKv` object with matching API (`get`, `set`, `setex`, `del`, `keys`)

**Prompt Builders (`src/lib/prompts.js`):**
- Purpose: Construct deterministic, injection-safe prompt strings for each generation scenario
- Functions: `buildGenerateWeekPrompt`, `buildRegenerateTweetPrompt`, `buildCompletionPrompt`, `buildSelfImprovementPrompt`, `buildSpikeUpgradePrompt`
- All user-provided profile values are sanitized via `sanitize()` before inclusion

**Tweet Scorer (`src/lib/scoring.js`):**
- Purpose: Produce a deterministic 0-100 quality score without an AI call
- Dimensions scored: hook strength (25 pts), specificity (20 pts), engagement signals (15 pts), visual formatting (15 pts), length/density (10 pts), CTA quality (10 pts), second-line weakness penalty (5 pts)

## Entry Points

**Browser SPA:**
- Location: `src/main.jsx`
- Triggers: `index.html` loaded by browser; Vite dev server or Vercel static hosting
- Responsibilities: Mount React app into `#root`

**Local Dev API Server:**
- Location: `server.js`
- Triggers: `node server.js` (requires `ANTHROPIC_API_KEY` and `API_TOKEN` env vars)
- Responsibilities: Serve all `/api/*` routes with CORS, act as the authenticated proxy in local development

**Vercel Cron Job:**
- Location: `api/cron/post-tweets.js`
- Triggers: Hourly schedule defined in `vercel.json` (`0 * * * *`); also callable via `GET /api/cron/post-tweets`
- Responsibilities: Scan all queued tweet sessions, refresh OAuth tokens if needed, post due tweets to X

## Error Handling

**Strategy:** Fail-visible in UI; fail-gracefully in background operations

**Patterns:**
- Generation errors: caught in `generateWeek`, set `view` to `'error'`, render `ErrorScreen` with retry and back-to-setup options
- Improvement pass errors: per-tweet try/catch; failed tweets get `improveFailed: true` and are kept in the batch with their previous state
- Regeneration errors: caught in `handleRegenerate`, set `regenError` state (auto-clears after 5 s), shown as banner in `WeeklyPlanner`
- API proxy errors: Express returns HTTP status + JSON `{ error: "..." }`; cron handler returns `{ posted, errors }` counts and logs per-tweet failures to console
- Defective tweet detection: `hasTweetDefect(text, templateName)` in `src/lib/ai.js` provides structural validation for 10+ tweet formats; triggers automatic improvement passes

## Cross-Cutting Concerns

**Logging:** `console.log` / `console.warn` / `console.error` — no structured logging library; generation improvement steps log `[improve]` and `[cron]` prefixed messages

**Validation:** Input sanitization in `src/lib/prompts.js#sanitize()` (strips newlines, control chars, limits length); API token check via `x-app-token` header in `server.js`; PKCE state validation in `api/auth/x/callback.js`

**Authentication:** Two independent auth surfaces — (1) browser-to-proxy: `x-app-token` static header; (2) proxy-to-X: OAuth 2.0 PKCE with automatic token refresh in `lib/x-auth.js#getValidAccessToken`

---

*Architecture analysis: 2026-05-05*
