# Tweet Command Center

Generates a week of ready-to-post tweets (15 tweets across Monday–Friday, 3 per day) from a creator profile using the Anthropic Claude API. Tweets are scored, auto-improved across two quality passes, and laid out in a kanban-style weekly planner where you can approve, edit, regenerate, and export them.

## Prerequisites

- Node.js ≥ 18
- An [Anthropic API key](https://console.anthropic.com)

## Local setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Fill in ANTHROPIC_API_KEY, API_TOKEN, and VITE_API_TOKEN in .env
# API_TOKEN and VITE_API_TOKEN must be the same value — generate one with:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Start the proxy server (terminal 1)
node server.js

# 4. Start the frontend dev server (terminal 2)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The frontend talks to the proxy at port 3001, which forwards authenticated requests to the Anthropic API.

## Running tests

```bash
npm test
```

Integration tests that call the live API are skipped by default. Set `ANTHROPIC_API_KEY` in your environment and run with `--run` to execute them.

## Deployment (Vercel)

1. Push the repo to GitHub.
2. Import it into [Vercel](https://vercel.com).
3. Add these environment variables in the Vercel project settings:
   - `ANTHROPIC_API_KEY` — your Anthropic key
   - `API_TOKEN` — same shared secret as `VITE_API_TOKEN`
   - `VITE_API_TOKEN` — read by the frontend bundle at build time
   - `ALLOWED_ORIGIN` — your Vercel deployment URL (e.g. `https://your-app.vercel.app`)
4. Deploy. The `api/messages.js` serverless function handles all Claude requests.

## Architecture

```
Browser (React + Vite)
  └── /api/messages  ──►  server.js (local) / api/messages.js (Vercel)
                                └── Anthropic Claude API
```

The proxy validates the `X-App-Token` header, hard-codes the model to `claude-sonnet-4-6`, caps `max_tokens` at 16 000, and only forwards `messages`, `max_tokens`, and `system` fields — the browser never touches the Anthropic key directly.

## Project structure

```
src/
  App.jsx              — main state machine (setup → planner → schedule)
  lib/
    ai.js              — Claude client, defect detection, JSON parsing
    prompts.js         — prompt builders for generation, improvement, regeneration
    scoring.js         — tweet quality scoring
    ctas.js            — CTA pool selection and hallucination stripping
    scheduler.js       — time-slot assignment and date helpers
    templates.js       — tweet template definitions
    trends.js          — trending topic data (currently mock)
  components/
    SetupForm.jsx      — creator profile form
    WeeklyPlanner.jsx  — kanban board
    TweetCard.jsx      — individual tweet card with score, actions, time picker
    TweetEditor.jsx    — edit/regenerate modal
    ScheduleReview.jsx — approve and export tweets for scheduling
api/
  messages.js          — Vercel serverless proxy
server.js              — Express dev proxy
```
