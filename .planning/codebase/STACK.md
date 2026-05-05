# Technology Stack

**Analysis Date:** 2026-05-05

## Languages

**Primary:**
- JavaScript (ESM) — all source files, both frontend (`src/`) and backend (`api/`, `lib/`, `server.js`)
- JSX — React component files in `src/components/` and `src/App.jsx`

**Secondary:**
- None detected (no TypeScript, no Python, no other language)

## Runtime

**Environment:**
- Node.js >=18.0.0 (enforced via `engines` field in `package.json`)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- React 19.2.0 — UI component framework, entire frontend SPA (`src/`)
- Express 5.2.1 — local dev proxy server (`server.js`); not used in Vercel production (Vercel uses serverless function handlers directly)

**Styling:**
- Tailwind CSS 4.1.18 — utility-first CSS via `@tailwindcss/vite` Vite plugin; no separate config file, configured inline in `vite.config.js`

**Icons:**
- lucide-react 0.563.0 — SVG icon components used throughout UI

**Build/Dev:**
- Vite 7.2.4 — dev server, HMR, and production bundler; config at `vite.config.js`
- `@vitejs/plugin-react` 5.1.1 — React JSX transform for Vite

**Testing:**
- Vitest 4.1.4 — test runner; runs with `npm test` (`vitest run`); no separate config file (uses Vite config)

**Linting:**
- ESLint 9.39.1 — flat config at `eslint.config.js`
- `eslint-plugin-react-hooks` 7.0.1 — hooks lint rules
- `eslint-plugin-react-refresh` 0.4.24 — fast refresh lint rules

## Key Dependencies

**Critical:**
- `@upstash/redis` 1.37.0 — Redis client for Upstash; used in `lib/kv.js` for OAuth token and tweet queue persistence; dynamically imported only when env vars are present (falls back to in-memory Map for local dev)

**Infrastructure:**
- `cors` 2.8.6 — CORS middleware for local Express proxy (`server.js`)
- `express` 5.2.1 — local dev proxy only; Vercel production uses native serverless function handlers in `api/`

## Configuration

**Environment:**
- Environment variables loaded by Node.js at runtime; Vite exposes only `VITE_`-prefixed vars to the browser bundle
- Key required vars:
  - `ANTHROPIC_API_KEY` — Anthropic API key (required, checked at server start in `server.js`)
  - `API_TOKEN` — shared secret between frontend and proxy (required, checked at server start)
  - `VITE_API_TOKEN` — browser-side token, must match `API_TOKEN` (exposed to bundle via Vite)
  - `ALLOWED_ORIGIN` — CORS allowed origin (defaults to `http://localhost:5173`)
  - `X_CLIENT_ID` — X OAuth 2.0 client ID (optional, disables X features if absent)
  - `X_CLIENT_SECRET` — X OAuth 2.0 client secret
  - `X_CALLBACK_URL` — OAuth redirect URI
  - `UPSTASH_REDIS_REST_URL` — Upstash Redis REST URL (also accepts `KV_REST_API_URL`)
  - `UPSTASH_REDIS_REST_TOKEN` — Upstash Redis REST token (also accepts `KV_REST_API_TOKEN`)
  - `CRON_SECRET` — Vercel cron authorization secret
- `.env.example` present at project root documenting all vars (no `.env` committed)

**Build:**
- `vite.config.js` — plugins: React + Tailwind CSS
- `vercel.json` — build command, output directory (`dist`), SPA rewrite rule, hourly cron job definition
- `eslint.config.js` — flat ESLint config, targets `**/*.{js,jsx}`

## Platform Requirements

**Development:**
- Node.js >=18.0.0
- Run frontend: `npm run dev` (Vite dev server on port 5173)
- Run backend proxy: `node server.js` (Express on port 3001)
- Both must run concurrently for local development

**Production:**
- Deployed to Vercel
- Frontend: Vite build output in `dist/`, served as static files
- Backend: Serverless functions in `api/` directory (Vercel auto-discovers)
- Cron: Vercel Cron triggers `GET /api/cron/post-tweets` hourly (`"schedule": "0 * * * *"`)
- Storage: Upstash Redis via Vercel Storage integration

---

*Stack analysis: 2026-05-05*
