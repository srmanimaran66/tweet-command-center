# Testing Patterns

**Analysis Date:** 2026-05-05

## Test Framework

**Runner:**
- Vitest 4.x
- Config: none — Vitest picks up config from `vite.config.js` via `@vitejs/plugin-react`; no separate `vitest.config.js`

**Assertion Library:**
- Vitest built-in (`expect`) — no separate assertion library

**Run Commands:**
```bash
npx vitest run                                         # Run all tests (CI mode, no watch)
npx vitest                                             # Watch mode
npx vitest run src/lib/__tests__/integration.test.js   # Integration tests (requires ANTHROPIC_API_KEY)
ANTHROPIC_API_KEY=sk-... npx vitest run src/lib/__tests__/integration.test.js
```

No coverage command is configured; no `--coverage` flag or threshold in package scripts.

## Test File Organization

**Location:**
- Co-located `__tests__/` directory inside the module being tested
- All tests live at `src/lib/__tests__/`
- No test files adjacent to React components — components are not tested

**Naming:**
- `<scope>.test.js` convention: `lib.test.js`, `scoring.test.js`, `prompts.test.js`, `integration.test.js`
- Each file covers one module or a related group of modules

**Structure:**
```
src/lib/
├── ai.js
├── scoring.js
├── prompts.js
├── scheduler.js
├── ctas.js
├── templates.js
├── trends.js
└── __tests__/
    ├── lib.test.js          # ai.js + scheduler.js + ctas.js (cross-module integration)
    ├── scoring.test.js      # scoring.js
    ├── prompts.test.js      # prompts.js
    └── integration.test.js  # Live API calls (skipped without ANTHROPIC_API_KEY)
```

## Test Structure

**Suite Organization:**
```js
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

// Banner comment explaining the bug this suite covers
// ─── Failure N: description ───────────────────────────────────────────────────
// Symptom: ...
// Root cause: ...
// Fix: ...

describe('functionName — what aspect is tested', () => {
  test('specific condition → expected outcome', () => {
    const result = functionUnderTest(input);
    expect(result).toBe(expected);
  });
});
```

**Patterns:**
- `beforeEach` used for state reset: `beforeEach(() => resetCtaTracking())` in `lib.test.js`
- `afterEach(() => vi.useRealTimers())` after fake-timer tests in `lib.test.js`
- Shared fixture constants defined at file top: `const PROFILE = { primaryTopic: ..., tone: ... }`
- No `beforeAll`/`afterAll` except in integration tests for API setup

**Describe naming convention:**
- Format: `'functionName — what aspect'`
- Examples: `'scoreTweet — hook strength'`, `'hasTweetDefect — before_after New: label, hot_take sentences'`
- Describes what is being exercised, not what the function does

**Test naming convention:**
- Format: `'condition/input → expected result'`
- Uses `→` for input-to-output clarity: `'strong keyword hook ≥20 chars → 25'`
- Uses IS/IS NOT for boolean outcomes: `'before_after missing New: block IS defective (label check)'`
- Uses plain English for routing tests: `'tweet with score 60 routes to self-improve'`

## Mocking

**Framework:** Vitest built-in (`vi`)

**Time mocking pattern (in `lib.test.js`):**
```js
import { afterEach, vi } from 'vitest';

afterEach(() => vi.useRealTimers());

test('called on a Monday returns today', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-20T09:00:00')); // Monday
  const result = getNextMonday();
  // assert on result
});
```

**What IS mocked:**
- System time via `vi.useFakeTimers()` + `vi.setSystemTime()` for date-dependent functions
- No module-level mocks (`vi.mock()`) anywhere — modules are imported and called directly

**What is NOT mocked:**
- The Anthropic API in unit tests — integration tests call it live with real `fetch`
- File system, localStorage, or browser APIs — no mocks for these exist
- Internal module functions — all functions tested through their public exports

**Module-level state reset:**
- `ctas.js` exports `resetCtaTracking()` specifically to enable test isolation
- Called in `beforeEach` in `lib.test.js` to prevent CTA pool state from leaking between tests:
  ```js
  beforeEach(() => resetCtaTracking());
  ```

## Fixtures and Factories

**Inline fixtures (no factory files):**

All test data is declared inline at the top of each test file:

```js
// scoring.test.js
const PROFILE = {
  primaryTopic: 'solopreneur systems',
  secondaryTopic: 'founder productivity',
  tone: 'direct',
};

// prompts.test.js
const PROFILE = { ... };
const TRENDS = [
  { title: 'AI agents are replacing junior roles', summary: '...' },
];

// integration.test.js
const INCOMPLETE_TWEET = { templateName: 'before_after', fullText: '...' };
```

**Helper functions in tests:**
```js
// In scoring.test.js — generates a string of given length for clarity tests
function tweetOfLength(len) {
  return 'x'.repeat(len);
}
```

**No shared fixture files** — each test file declares its own constants. No `fixtures/`, `factories/`, or `__fixtures__/` directory.

## Coverage

**Requirements:** None enforced — no `--coverage` flag, no threshold config, no coverage CI gate.

**View Coverage:**
```bash
npx vitest run --coverage    # Requires @vitest/coverage-v8 (not installed)
```

Coverage tooling is not installed. No coverage reports are generated.

## Test Types

**Unit Tests (`lib.test.js`, `scoring.test.js`, `prompts.test.js`):**
- Pure function unit tests — no I/O, no network, no DOM
- Test each exported function from `src/lib/` in isolation with direct input/output assertions
- `lib.test.js` crosses module boundaries (tests `ai.js`, `scheduler.js`, `ctas.js` together) but still makes no network calls

**Integration Tests (`integration.test.js`):**
- Live API calls to Anthropic using real `fetch` — not mocked
- Guarded by `process.env.ANTHROPIC_API_KEY` check at file top
- Tests automatically skip when key is absent using `test.skipIf(!HAS_KEY)(...)`
- `beforeAll` with 60-second timeout for API warmup
- Used to validate that prompts produce structurally valid AI output (not just that functions run)

**E2E Tests:**
- Not used. No Playwright, Cypress, or similar tooling installed.

**Component Tests:**
- Not used. No React Testing Library or component-level tests. All UI is manually tested.

## Common Patterns

**Async Testing (integration tests only):**
```js
import { beforeAll, test } from 'vitest';

let tweets = [];

beforeAll(async () => {
  if (!HAS_KEY) return;
  const raw = await callDirect(PROMPT, 3000);
  tweets = parseJSON(raw);
}, 60000); // 60-second timeout for API call

test.skipIf(!HAS_KEY)('every tweet has a second paragraph', () => {
  const failures = tweets.filter(t => hasTweetDefect(t.fullText, 'lessons_learned'));
  expect(failures).toHaveLength(0);
});
```

**Error Testing:**
```js
// Assert function does NOT throw
expect(() => parseJSON(response)).not.toThrow();

// Assert result after error-handling path
const result = parseJSON(response);
expect(Array.isArray(result)).toBe(true);
```

**Failure debugging pattern (integration tests):**
```js
// Print defective items + the prompt that caused them when a test fails
if (failures.length > 0) {
  console.log('\n══ DEFECTIVE TWEET(S) ══');
  for (const f of failures) {
    console.log(`\nTweet ${f.index}:\n${f.text}`);
  }
  console.log('\n══ PROMPT USED ══\n' + PROMPT);
}
expect(failures).toHaveLength(0);
```

**Boundary value testing (scoring.test.js):**
```js
// Each scoring tier has its own test case at the boundary
test('80–220 chars → 20', () => { ... });
test('221–280 chars → 17', () => { ... });
test('>280 chars → 8', () => { ... });
test('<80 chars → 10', () => { ... });
```

**Routing logic mirrored in tests:**
```js
// integration.test.js mirrors the exact routing logic from App.jsx generateWeek()
function routeImprovement(tweet) {
  if (tweet.defective) return 'completion';
  if (tweet.score < 65) return 'self-improve';
  if (tweet.score > 85) return 'spike';
  return null;
}
// Test comment: "Mirrors the exact routing logic in App.jsx generateWeek()"
// App.jsx lines 151-162 exactly reproduced to test threshold boundary cases
```

**Regression test naming pattern:**
- Each `describe` block in `lib.test.js` is prefixed with the original failure number:
  `'Failure 1: DAY_OFFSETS[4] applies -10 HOURS not -10 minutes'`
- This traces test coverage directly back to reported bugs

---

*Testing analysis: 2026-05-05*
