# Codebase Structure

**Analysis Date:** 2026-05-05

## Directory Layout

```
tweet-command-center/
├── api/                    # Serverless API handlers (Vercel) — mirror of server.js routes
│   ├── auth/
│   │   └── x/             # X OAuth 2.0 PKCE flow
│   │       ├── callback.js
│   │       ├── connect.js
│   │       ├── disconnect.js
│   │       └── status.js
│   ├── cron/
│   │   └── post-tweets.js # Hourly tweet posting job
│   ├── messages.js        # (route handled inline in server.js — no separate file)
│   └── schedule/
│       ├── push.js        # Write approved tweets to KV queue
│       └── status.js      # Read queue state for UI display
├── lib/                   # Server-side shared utilities (Node only)
│   ├── kv.js              # KV abstraction: Upstash Redis or in-memory Map
│   └── x-auth.js          # X OAuth helpers, token refresh, cookie utils
├── public/                # Static assets served by Vite
├── src/                   # React SPA source
│   ├── assets/            # Images, SVGs
│   ├── components/        # UI components (view-level)
│   │   ├── ScheduleReview.jsx
│   │   ├── SetupForm.jsx
│   │   ├── TweetCard.jsx
│   │   ├── TweetEditor.jsx
│   │   └── WeeklyPlanner.jsx
│   ├── lib/               # Client-side domain logic (browser-safe, no Node APIs)
│   │   ├── __tests__/
│   │   │   ├── integration.test.js
│   │   │   ├── lib.test.js
│   │   │   ├── prompts.test.js
│   │   │   └── scoring.test.js
│   │   ├── ai.js          # Claude API client + text utilities
│   │   ├── ctas.js        # CTA pool selection and AI-CTA stripping
│   │   ├── prompts.js     # Prompt builders for all generation scenarios
│   │   ├── scheduler.js   # Schedule assignment and date utilities
│   │   ├── scoring.js     # Deterministic 0-100 tweet quality scorer
│   │   ├── templates.js   # Tweet template definitions (metadata only)
│   │   └── trends.js      # Mock trend data + profile-matched filtering
│   ├── App.css
│   ├── App.jsx            # Root component — all state, generation pipeline
│   ├── index.css          # Tailwind base styles
│   └── main.jsx           # React DOM entry point
├── .github/
│   └── workflows/         # CI configuration
├── .planning/
│   └── codebase/          # GSD codebase analysis documents
├── eslint.config.js
├── index.html             # Vite HTML entry point
├── package.json
├── package-lock.json
├── server.js              # Local dev Express server (mirrors api/ routes)
├── SETUP.md
├── vercel.json            # Vercel build config + cron schedule
└── vite.config.js
```

## Directory Purposes

**`api/`:**
- Purpose: Vercel serverless function handlers — each file exports a default `async function handler(req, res)`
- Contains: X OAuth flow, tweet queue management, cron poster
- Key files: `api/cron/post-tweets.js`, `api/auth/x/callback.js`, `api/schedule/push.js`
- Note: The `/api/messages` Anthropic proxy route is defined inline in `server.js` and served by Vercel's implicit file-based routing via `vercel.json`

**`lib/`:**
- Purpose: Node.js-only server utilities shared across all `api/` handlers
- Contains: KV store abstraction, X OAuth primitives
- Key files: `lib/kv.js`, `lib/x-auth.js`
- Important: Do NOT import these from `src/` — they use Node built-ins (`crypto`, dynamic `@upstash/redis` import) incompatible with the browser bundle

**`src/components/`:**
- Purpose: View-level React components — each maps to one application screen or a reusable card
- Contains: `SetupForm.jsx` (profile input), `WeeklyPlanner.jsx` (5-day board), `TweetCard.jsx` (single tweet card), `TweetEditor.jsx` (inline edit modal), `ScheduleReview.jsx` (approve + X publish screen)
- Key files: `WeeklyPlanner.jsx` is the most complex component; receives all callbacks from `App.jsx`

**`src/lib/`:**
- Purpose: Browser-safe, stateless domain logic — pure functions only, no React, no Node APIs
- Contains: AI client, content generation utilities, scoring engine, scheduling math, prompt builders, CTA pools, template metadata, trend data
- Key files: `ai.js` (Claude client + structural validators), `prompts.js` (all prompt builders), `scoring.js` (quality scorer)

**`src/lib/__tests__/`:**
- Purpose: Vitest unit and integration tests for `src/lib/` modules
- Contains: `lib.test.js` (ai.js and ctas.js), `scoring.test.js` (scorer), `prompts.test.js` (prompt builders), `integration.test.js` (live API tests, skipped without `ANTHROPIC_API_KEY`)

## Key File Locations

**Entry Points:**
- `src/main.jsx`: React DOM mount — first file executed in the browser
- `src/App.jsx`: Application root — all state management and the generation pipeline
- `server.js`: Local development server — start with `node server.js`
- `index.html`: Vite HTML shell

**Configuration:**
- `vite.config.js`: Vite build configuration (React plugin, Tailwind v4 plugin)
- `vercel.json`: Vercel deployment — build command, output dir, SPA rewrite rule, cron schedule
- `eslint.config.js`: ESLint flat config
- `package.json`: Scripts (`dev`, `build`, `test`, `lint`, `preview`), dependencies

**Core Logic:**
- `src/lib/ai.js`: `callClaude`, `parseJSON`, `enforceCharLimit`, `cleanTweetArtifacts`, `hasTweetDefect`
- `src/lib/prompts.js`: `buildGenerateWeekPrompt`, `buildRegenerateTweetPrompt`, `buildCompletionPrompt`, `buildSelfImprovementPrompt`, `buildSpikeUpgradePrompt`
- `src/lib/scoring.js`: `scoreTweet`, `scoreAllTweets`
- `src/lib/ctas.js`: `applyCtasToTweets`, `pickCta`, `resetCtaTracking`
- `src/lib/scheduler.js`: `assignSchedule`, `getNextMonday`, `getDayLabel`, `formatScheduledDate`
- `lib/kv.js`: `getKv` — always call this to get the store; never instantiate Redis directly
- `lib/x-auth.js`: `getValidAccessToken`, `postTweet`, `exchangeCode`, `refreshTokens`, `generatePkce`

**Testing:**
- `src/lib/__tests__/lib.test.js`: Main unit tests
- `src/lib/__tests__/scoring.test.js`: Scorer unit tests
- `src/lib/__tests__/prompts.test.js`: Prompt builder tests
- `src/lib/__tests__/integration.test.js`: Live API tests (conditionally skipped)

## Naming Conventions

**Files:**
- React components: `PascalCase.jsx` — e.g., `WeeklyPlanner.jsx`, `TweetCard.jsx`
- Non-component JS modules: `kebab-case.js` — e.g., `x-auth.js`, `post-tweets.js`
- Test files: `<module>.test.js` co-located in `__tests__/` under the module's directory

**Directories:**
- Lowercase with hyphens for multi-word: `x/` (OAuth provider), `__tests__/` (test directory)
- No barrel `index.js` files — import directly from the specific module file

**Functions:**
- Exported functions: `camelCase` verbs — `buildGenerateWeekPrompt`, `scoreAllTweets`, `assignSchedule`
- API route handlers: `default export` anonymous or named `handler` function
- Internal helpers: `camelCase`, unexported

**Constants:**
- Module-level config: `SCREAMING_SNAKE_CASE` — `BASE_SLOTS`, `WEEKLY_SCHEDULE`, `STRONG_HOOK_WORDS`
- React state keys: `camelCase` strings — `'tweetfull_profile'`, `'tweetfull_previous_week'`

## Where to Add New Code

**New UI screen/view:**
- Add component to `src/components/NewView.jsx`
- Add a new value to the `view` enum in `src/App.jsx`
- Add conditional render block in `App.jsx`'s render section
- Wire any required callbacks through props from `App.jsx`

**New generation prompt:**
- Add builder function to `src/lib/prompts.js` following the `build*Prompt` naming pattern
- Use `sanitize()` on any user-supplied string before interpolating into the prompt
- Call it from `src/App.jsx` inside `generateWeek` or `handleRegenerate`

**New tweet template:**
- Add template metadata object to `src/lib/templates.js`
- Add defect detection logic for the new `templateName` in `src/lib/ai.js#hasTweetDefect`
- Add it to the `WEEKLY_SCHEDULE` in `src/lib/prompts.js` if it belongs in a day slot

**New API endpoint:**
- Create `api/<category>/<action>.js` exporting `default async function handler(req, res)`
- Mirror the route in `server.js` for local dev
- Import `getKv` from `../../lib/kv.js` and `getSessionId` / token helpers from `../../lib/x-auth.js` as needed

**New server-side utility:**
- Add to `lib/kv.js` or `lib/x-auth.js` if related to existing concerns
- Create `lib/<new-name>.js` for unrelated utilities
- Never place Node-only code in `src/`

**New tests:**
- Place in `src/lib/__tests__/<module>.test.js`
- Use Vitest (`describe`, `test`, `expect`) — no test runner config needed beyond `vitest` in package.json
- Gate live API calls behind `const HAS_KEY = !!process.env.ANTHROPIC_API_KEY` and use `test.skipIf(!HAS_KEY)`

**Utilities (client-side):**
- Pure helpers with no React dependency: `src/lib/<name>.js`
- If the helper is specific to one module, keep it unexported within that module file

## Special Directories

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis documents consumed by planning and execution commands
- Generated: By `/gsd:map-codebase` agent
- Committed: Yes

**`.github/workflows/`:**
- Purpose: CI pipeline definitions
- Generated: No
- Committed: Yes

**`public/`:**
- Purpose: Static assets copied verbatim to `dist/` by Vite (no processing)
- Generated: No
- Committed: Yes

**`node_modules/`:**
- Purpose: Installed npm dependencies
- Generated: Yes (`npm install`)
- Committed: No

---

*Structure analysis: 2026-05-05*
