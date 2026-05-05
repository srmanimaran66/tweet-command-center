# Coding Conventions

**Analysis Date:** 2026-05-05

## Naming Patterns

**Files:**
- React components: PascalCase `.jsx` (e.g., `TweetCard.jsx`, `SetupForm.jsx`, `WeeklyPlanner.jsx`)
- Pure logic modules: camelCase `.js` (e.g., `ai.js`, `scoring.js`, `scheduler.js`, `ctas.js`)
- API route handlers: kebab-case filenames matching the route (e.g., `post-tweets.js`, `x-auth.js`)
- Test files: `<module>.test.js` inside `__tests__/` sibling directories

**Functions:**
- camelCase throughout: `scoreTweet`, `hasTweetDefect`, `parseJSON`, `enforceCharLimit`
- Boolean-returning helpers use verb prefixes: `hasTweetDefect`, `hasWeakSecondLine`
- Builder functions use `build` prefix: `buildGenerateWeekPrompt`, `buildCompletionPrompt`
- Action functions use verb prefix: `applyCtasToTweets`, `assignSchedule`, `pickCta`
- Private/internal helpers are unexported: `applyOffset`, `pad`, `stripTrailingCta`, `cleanListItems`

**Variables:**
- camelCase for local variables: `rawScore`, `hookText`, `charCount`
- SCREAMING_SNAKE_CASE for module-level constants: `ALLOWED_MODEL`, `STORAGE_KEY`, `BASE_SLOTS`, `DAY_OFFSETS`, `STRONG_HOOK_WORDS`, `OPEN_LOOP_PATTERNS`
- `_` prefix for module-level mutable state that is an implementation detail: `_moduleTracking` in `ctas.js`

**Components:**
- Default exports for React components — one component per file
- Named exports for non-default utility exports (e.g., `TONE_RISK_OVERRIDES` from `SetupForm.jsx`)
- Internal sub-components defined in the same file and NOT exported: `SkeletonCard`, `ErrorScreen`, `createSkeletons`

**Constants in config objects:**
- Object keys use camelCase: `{ hookStrength, clarity, topicRelevance }`
- Lookup maps use SCREAMING_SNAKE_CASE: `TYPE_CONFIG`, `GOAL_LABELS`, `WEEKLY_SCHEDULE`, `POOLS`

## Code Style

**Formatting:**
- No Prettier config present — formatting is ESLint-enforced only
- 2-space indentation throughout all `.js` and `.jsx` files
- Single quotes for strings in JS/JSX (`'direct'`, `'solopreneur'`)
- Template literals used for multi-part string composition
- Trailing commas used in multi-line arrays and objects
- Arrow functions preferred for callbacks; named functions for top-level declarations

**Linting:**
- ESLint 9 flat config at `eslint.config.js`
- Base: `@eslint/js` recommended
- Plugins: `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- Key rule: `no-unused-vars` errors except for names matching `/^[A-Z_]/` (screaming-snake constants allowed)
- `ecmaVersion: 2020`; JSX enabled; `sourceType: 'module'`

## Import Organization

**Order (observed pattern):**
1. React core imports (`import { useState, useCallback } from 'react'`)
2. Component imports from `./components/` (`import SetupForm from './components/SetupForm.jsx'`)
3. Internal lib imports from `./lib/` (`import { callClaude } from './lib/ai.js'`)
4. Icon/UI library imports (`import { AlertCircle, RefreshCw } from 'lucide-react'`)
5. Node built-ins in server-side files (`import crypto from 'crypto'`)

**Path style:**
- Relative paths only — no path aliases configured
- Extensions always explicit (`.js`, `.jsx`) — required for ESM
- `.jsx` extension used for React component files, `.js` for everything else

## Error Handling

**API handlers (`api/`):**
- All async handlers wrapped in `try/catch`
- Errors returned as `res.status(5xx).json({ error: 'message' })`
- Input validation at the top of each handler before any async work
- `console.error` on caught errors in server context

**Frontend lib functions (`src/lib/`):**
- Pure utility functions do not catch — they throw and let callers handle
- `parseJSON` in `src/lib/ai.js` attempts multiple parse strategies before throwing `Error('Could not parse JSON from response')`
- `callClaude` in `src/lib/ai.js` throws on non-ok HTTP status with a structured message: `` `API request failed (${response.status}): ${err}` ``

**React App (`src/App.jsx`):**
- Generation pipeline wrapped in a top-level `try/catch` that transitions to an error view (`setView('error')`)
- Per-tweet async operations use individual `try/catch` and log with `console.warn` — failures are non-fatal, recorded as `improveFailed: true` on the tweet
- Fatal errors set `error` state and route to `ErrorScreen` component
- Regeneration errors set `regenError` state with a 5-second auto-clear via `setTimeout`

**Logging conventions:**
- `console.log` for pipeline progress: `[improve] Day X slot Y score=Z → self-improve`
- `console.warn` for recoverable per-tweet failures with `[improve pass N]` prefix
- `console.error` for fatal generation errors and API-level errors

## Comments

**Section dividers:**
- Horizontal rule comments using `─` character to visually separate major function groups: `// ─── Generation pipeline ──────────────────────────────────────────────`
- Used consistently in `src/App.jsx`, `src/lib/scoring.js`, `src/lib/ctas.js`, `lib/x-auth.js`

**Inline comments:**
- Short explanatory comments on constant arrays: `// Tweet 1 — midday peak`
- Algorithm intent described in comments before non-obvious logic (e.g., `// Search from the right: Claude puts JSON last...`)
- Bug context in test files: large banners explain root cause before each `describe` block

**JSDoc:**
- Used selectively for exported utility functions in `src/lib/ai.js`:
  ```js
  /**
   * Strip generation artifacts (<tweet> placeholder, stray leading <) from raw tweet text.
   */
  export function cleanTweetArtifacts(text) {
  ```
- Not used for React components or scoring functions

## Function Design

**Size:** Functions are focused — most under 30 lines. The exception is `hasTweetDefect` (~75 lines) which handles many template-specific branches.

**Parameters:**
- Positional for 1–2 params: `scoreTweet(tweet, profile)`, `hasTweetDefect(text, templateName)`
- Options object with defaults for optional config: `callClaude(userPrompt, { maxTokens = 8000 } = {})`
- Default parameter values used throughout: `templateName = ''`, `timeZone = 'America/New_York'`, `limit = 280`

**Return Values:**
- Pure functions return values directly — no mutation of inputs
- Scoring functions return objects with named keys: `{ score, breakdown }`
- Pipeline functions return new arrays via `.map()` — tweets are always immutable
- Boolean-returning validators return `true` = defective/problematic (positive means problem)

## Module Design

**Exports:**
- Named exports for all utility functions and constants
- Default export only for React components
- No barrel files (`index.js`) — direct imports from module files

**Module-level state:**
- Minimized; only `ctas.js` holds module-level mutable state (`_moduleTracking`) for CTA deduplication
- Reset function exported for test isolation: `export function resetCtaTracking()`

**ESM throughout:**
- `"type": "module"` in `package.json`
- All files use `import`/`export` syntax — no `require()`

---

*Convention analysis: 2026-05-05*
