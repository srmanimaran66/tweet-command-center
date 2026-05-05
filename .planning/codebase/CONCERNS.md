# Codebase Concerns

**Analysis Date:** 2026-05-05

---

## Tech Debt

**Module ID counter resets on page reload:**
- Issue: `let nextId = 1` in `src/App.jsx` line 58 is a module-level counter. Every page refresh resets it to 1, meaning tweet IDs like `tw_1_<timestamp>` repeat across sessions. If a queue in KV contains a tweet from a previous session with the same reconstructed ID, the queue merge in `api/schedule/push.js` will silently overwrite it via `incomingIds.has(t.id)`.
- Files: `src/App.jsx` (line 58-59), `api/schedule/push.js` (line 30-31)
- Impact: Potential silent queue corruption if a user generates a second week without reloading and then schedules.
- Fix approach: Replace with `crypto.randomUUID()` or a UUID library to generate globally unique IDs.

**Hardcoded model name duplicated in two places:**
- Issue: `const ALLOWED_MODEL = 'claude-sonnet-4-6'` is defined in both `server.js` (line 32) and `api/messages.js` (line 1). They must be kept in sync manually.
- Files: `server.js` (line 32), `api/messages.js` (line 1)
- Impact: A model upgrade will be missed in one environment (local vs. Vercel) if only one file is changed.
- Fix approach: Extract to a shared constant in `lib/constants.js` and import in both.

**`server.js` and `api/messages.js` duplicate the entire Anthropic proxy logic:**
- Issue: The POST `/api/messages` handler — auth check, token cap, payload construction, Anthropic fetch, error handling — is implemented twice: once in `server.js` (lines 35-73) for local development and once in `api/messages.js` for Vercel serverless. Any change to the proxy must be applied in both files.
- Files: `server.js`, `api/messages.js`
- Impact: Divergence between local and production behavior; maintenance burden doubles for every proxy change.
- Fix approach: Move shared handler logic to `lib/anthropic-proxy.js` and import it in both `server.js` and `api/messages.js`.

**`sanitize()` function in `src/lib/prompts.js` strips hyphens from user input:**
- Issue: The regex `[\r\n -]` (line 29 of `prompts.js`) is a character class range from space (0x20) to hyphen (0x2D), which also silently strips `!`, `"`, `#`, `$`, `%`, `&`, `'`, `(`, `)`, `*`, `+`, `,`, `-`, and `.` — everything between ASCII 0x20 and 0x2D. This corrupts topic names like "B2B Sales" (hyphen stripped) and "No-Code" (hyphen stripped).
- Files: `src/lib/prompts.js` (line 29)
- Impact: Profile fields with hyphens (very common) are silently mangled before being injected into the prompt, degrading generation quality.
- Fix approach: Change `[\r\n -]` to `[\r\n]` to only strip line breaks, or list characters individually.

**Trends data is entirely static mock data:**
- Issue: `src/lib/trends.js` exports `MOCK_TRENDS` — a hardcoded array of 10 trend objects with no live data source. The function `getTrendsForProfile()` ranks these static trends against the user's profile, giving the illusion of dynamic trend injection.
- Files: `src/lib/trends.js`
- Impact: All users receive the same 10 trends indefinitely, regardless of actual market events. Trends dated to 2026 will become stale. The content differentiation value of "Trending Topics This Week" in the prompt is zero.
- Fix approach: Integrate a real trends API (e.g., Tavily, Perplexity, or a lightweight RSS aggregator) or add a weekly refresh mechanism.

**`kv.keys('queue:*')` in cron will not scale:**
- Issue: `api/cron/post-tweets.js` line 13 calls `kv.keys('queue:*')` which in Upstash Redis scans all keys matching the pattern. Redis KEYS is O(N) over the entire keyspace and blocks the server during execution.
- Files: `api/cron/post-tweets.js` (line 13), `lib/kv.js`
- Impact: At low user counts this is fine. At hundreds of concurrent users, each hourly cron execution will degrade Redis performance proportionally. Upstash's REST API adds latency on top.
- Fix approach: Maintain a dedicated `active_sessions` set in Redis using `SADD`/`SMEMBERS` and iterate that instead of scanning all keys.

---

## Known Bugs

**`hasTweetDefect` number-ending false-positive (partially fixed, edge case remains):**
- Symptoms: Tweets that intentionally end with a standalone number like "Not 10. Not 5. Just 3" are still flagged as defective by the `\s\d+$` regex, even though they are complete thoughts. The test in `src/lib/__tests__/lib.test.js` (line 43-60) documents this as a known failure and expects `hasTweetDefect` to return `false`, but the current regex implementation `if (/\s\d+$/.test(text.trimEnd())) return true` (line 66, `src/lib/ai.js`) will still incorrectly flag "Just 3" (preceded by a space).
- Files: `src/lib/ai.js` (line 66), `src/lib/__tests__/lib.test.js` (line 48)
- Trigger: Any tweet ending with a space followed by a digit where the digit is a legitimate count, not a truncation artifact.
- Workaround: Users can hit Redo manually; the second pass typically does not trigger the same pattern.

**`handleUpdateTime` in `src/App.jsx` ignores timezone:**
- Symptoms: When a user changes a tweet's scheduled time via the time picker, the `scheduledAt` ISO string is reconstructed using `date.setHours(hour24, m, 0, 0)` (local machine time), ignoring the `timeZone` stored on the tweet. On a machine in UTC+5, a "12:15 PM Eastern" time will be stored as 12:15 PM local, not 12:15 PM Eastern.
- Files: `src/App.jsx` (lines 326-336)
- Trigger: User changes tweet time on any machine not in their selected timezone.
- Workaround: None — the cron job posts at the stored UTC time which may be hours off.

**`assignSchedule` uses server local time, not timezone-aware conversion:**
- Symptoms: `src/lib/scheduler.js` calls `date.setHours(hour, minute, 0, 0)` (line 36) which sets local machine clock hours. The `timeZone` parameter is stored on the tweet but never used for the actual `Date` calculation. On Vercel (UTC), tweets intended for 12:15 PM Eastern will be scheduled at 12:15 PM UTC (5 hours early).
- Files: `src/lib/scheduler.js` (lines 27-49)
- Trigger: Any user whose timezone differs from the server's timezone (all Vercel deployments run UTC).
- Workaround: None currently. Production tweet posting times will be wrong for all non-UTC users.

**Cron job skips sessions with expired tokens silently:**
- Symptoms: `api/cron/post-tweets.js` logs a warning and `continue`s past sessions where `getValidAccessToken` returns null. There is no notification to the user that their tweets were skipped. The queue is not cleaned up or retried.
- Files: `api/cron/post-tweets.js` (lines 25-29)
- Trigger: X access token has expired and the refresh token is also invalid or revoked.
- Workaround: User must manually check queue status via `GET /api/schedule/status`.

---

## Security Considerations

**`CRON_SECRET` is optional — cron endpoint is publicly accessible without it:**
- Risk: `api/cron/post-tweets.js` lines 7-9: if `CRON_SECRET` is not set in environment variables, the auth check is skipped entirely. Any unauthenticated caller can trigger the cron job, causing it to post all due tweets immediately or exhaust token quotas.
- Files: `api/cron/post-tweets.js` (lines 7-9)
- Current mitigation: Vercel enforces cron scheduling internally; the public endpoint is not advertised.
- Recommendations: Make `CRON_SECRET` required in production. Add a startup check like the one in `server.js` that exits if the secret is absent.

**`API_TOKEN` is optional in Vercel deployment:**
- Risk: `api/messages.js` lines 9-11: `if (appToken && ...)` — if `API_TOKEN` is not set, the token check is skipped and the Anthropic proxy is publicly accessible with no authentication. Any caller who discovers the `/api/messages` endpoint can proxy unlimited Anthropic API calls at the project owner's expense.
- Files: `api/messages.js` (lines 9-11)
- Current mitigation: `ALLOWED_ORIGIN` CORS check on line 13-16 provides a secondary check, but CORS is client-enforced and can be bypassed with `curl`.
- Recommendations: Make `API_TOKEN` required (fail-closed). Remove the `if (appToken &&...)` bypass.

**`ALLOWED_ORIGIN` check uses `startsWith` which allows subdomain spoofing:**
- Risk: `api/messages.js` line 15: `origin.startsWith(allowedOrigin)` — if `ALLOWED_ORIGIN` is `https://tweet-command-center.vercel.app`, an attacker could host `https://tweet-command-center.vercel.app.evil.com` and pass the check.
- Files: `api/messages.js` (line 15), `server.js` (line 13)
- Current mitigation: The `x-app-token` header check provides the real gate when `API_TOKEN` is set.
- Recommendations: Change to exact equality check: `origin === allowedOrigin || origin === allowedOrigin + '/'`.

**Tweet text size not validated on the server before queuing:**
- Risk: `api/schedule/push.js` accepts a `tweets` array with no validation of `t.fullText` length. A malicious caller could submit tweets with megabytes of text, which would be stored in Upstash Redis and later posted (or fail at the X API with a 400).
- Files: `api/schedule/push.js` (lines 19-27)
- Current mitigation: None.
- Recommendations: Validate `t.text.length <= 280` and `tweets.length <= 20` before accepting the payload.

**X OAuth disconnect does not clear the session cookie properly:**
- Risk: `api/auth/x/disconnect.js` line 15 sets `x_session=; Path=/; Max-Age=0` but does not include `HttpOnly` or `SameSite` attributes. The cookie is effectively expired but without the security attributes, this differs from how the cookie was set in `lib/x-auth.js` `sessionCookieHeader()`, which uses `HttpOnly; SameSite=Lax`.
- Files: `api/auth/x/disconnect.js` (line 15), `lib/x-auth.js` (line 93)
- Current mitigation: Token is deleted from KV before cookie expires, so replaying the old session ID would return no token.
- Recommendations: Use `sessionCookieHeader(sessionId, 0)` to clear with matching attributes.

**User-supplied prompt content injected into Anthropic prompt without structural escaping:**
- Risk: Profile fields (`voiceNotes`, `avoidTopics`, `techStack`, `audience`) are injected into prompt strings via template literals. The `sanitize()` function strips newlines but allows special characters that could confuse prompt structure — e.g., a user-supplied `voiceNotes` value of `"ignore all previous instructions and..."` would be sent verbatim to Claude.
- Files: `src/lib/prompts.js` (lines 26-32, 62-80)
- Current mitigation: The `sanitize()` function strips newlines and limits length. Claude is generally robust to injection in user-turn content.
- Recommendations: This is a low risk in the current trust model (single-user app), but worth noting for multi-tenant scenarios.

---

## Performance Bottlenecks

**Generation pipeline fires up to 45 parallel Anthropic API calls:**
- Problem: The generation pipeline in `src/App.jsx` runs two rounds of `Promise.all` over 15 tweets: pass 1 (lines 163-191) fires up to 15 simultaneous improvement calls, then pass 2 (lines 197-231) fires up to 15 more. Combined with the initial 1 generation call, a full generation cycle can make up to 31 concurrent Anthropic API requests (more if defects trigger both completion and improvement paths per tweet).
- Files: `src/App.jsx` (lines 163-231)
- Cause: No concurrency limit on `Promise.all` over tweet arrays.
- Improvement path: Use a concurrency-limited mapper (e.g., `p-limit` with limit 3-5) to avoid rate-limit 429s from Anthropic and reduce peak token throughput.

**No request cancellation on page navigation or re-generation:**
- Problem: If a user clicks "Start Over" or navigates away mid-generation, all in-flight `fetch` calls to `/api/messages` continue to completion with no way to cancel them. The results are silently discarded when the view changes, but the API costs are incurred.
- Files: `src/App.jsx` (lines 126-245), `src/lib/ai.js` (lines 4-31)
- Cause: `callClaude` does not accept an `AbortSignal`.
- Improvement path: Pass `AbortController` signals through `callClaude` and cancel on component unmount or view change.

**`kv.get` called once per session key per cron tick, sequentially:**
- Problem: `api/cron/post-tweets.js` uses a `for...of` loop (line 18) over all session keys. For each session, it sequentially awaits `kv.get(queueKey)` and `getValidAccessToken(kv, sessionId)`. At 50 sessions, this serializes 100+ KV round-trips per hourly cron invocation.
- Files: `api/cron/post-tweets.js` (lines 18-45)
- Cause: Sequential iteration instead of parallel fetch.
- Improvement path: Use `Promise.all` with a concurrency limit to fetch queue data for multiple sessions simultaneously.

---

## Fragile Areas

**`parseJSON` fallback is order-dependent and silently consumes malformed output:**
- Files: `src/lib/ai.js` (lines 168-189)
- Why fragile: The function tries `JSON.parse`, then `lastIndexOf('[')`, then `lastIndexOf('{')`. If Claude returns malformed JSON where the last `[` is inside prose (not the array start), `parseJSON` will throw a confusing "Could not parse JSON from response" error rather than a structured error with the actual Claude output. Debugging requires adding temporary console logging.
- Safe modification: Add the raw `text` to the thrown error message so failures surface the actual Claude response.
- Test coverage: `src/lib/__tests__/lib.test.js` covers the documented greedy-bracket case but not malformed JSON within the array/object itself.

**Tweet defect detection is template-name-dependent with silent fallback:**
- Files: `src/lib/ai.js` (lines 50-127)
- Why fragile: `hasTweetDefect` applies different rules based on `templateName`. If Claude returns a tweet with the wrong `templateName` (or none), the structural checks are skipped and the tweet may be served as complete when it isn't. The `before_after` template has a content-based fallback (`❌` emoji detection) but other templates do not.
- Safe modification: Add integration tests for each template type; do not add new template checks without a paired test in `src/lib/__tests__/lib.test.js`.
- Test coverage: Template-specific defect tests exist for `before_after`, `hot_take`, `simple_process`, `framework_3_step`, `lessons_learned`, `checklist`. The `prediction`, `common_mistake`, `myth_vs_truth`, `contrarian_insight`, `contrarian_tech`, `agree_disagree` templates have no structural defect tests.

**Time display/parsing is a lossy round-trip:**
- Files: `src/App.jsx` (lines 326-336), `src/lib/scheduler.js` (line 40)
- Why fragile: `displayTime` is formatted as `"12:15 PM"` (12-hour format) and then parsed back to 24-hour time in `handleUpdateTime`. The parser `h === 12 && meridiem === 'AM' ? 0 : h` correctly handles 12:00 AM but the `displayTime` formatter in `assignSchedule` uses `hour > 12 ? hour - 12 : hour === 0 ? 12 : hour` which maps hour 0 to 12. If a DAY_OFFSETS shift pushes a slot past midnight (e.g., a very large negative offset), the display time would show "12:xx PM" for midnight, and re-parsing would produce noon, not midnight.
- Safe modification: Replace the custom formatter with `Date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })` and store 24-hour time separately.

**`applyCtasToTweets` uses module-level mutable state for CTA deduplication:**
- Files: `src/lib/ctas.js` (lines 53-58, 87-88)
- Why fragile: `_moduleTracking` is a module-level singleton. `resetCtaTracking()` must be called in tests before each run (`src/lib/__tests__/lib.test.js` line 6). In production, the tracking state persists for the entire browser session. If `applyCtasToTweets` is called twice in the same session (e.g., on a second generation run), CTA deduplication from the first run bleeds into the second.
- Safe modification: `applyCtasToTweets` already creates a fresh `tracking` object internally (line 143) which is the correct pattern. The module-level `_moduleTracking` and `pickCta()` export are only for test compatibility and should be documented as deprecated.

---

## Scaling Limits

**Upstash Redis free tier:**
- Current capacity: 10,000 commands/day on the free tier.
- Limit: Each user generation + scheduling session touches approximately 4-6 KV commands (get pkce, del pkce, setex tokens, get queue, setex queue). The hourly cron adds `keys('queue:*')` + 2 commands per active session per hour (up to 720/day at 30 sessions). At ~20 active users, the daily command budget will be exhausted.
- Scaling path: Upgrade to Upstash Pay-As-You-Go ($0.20/100K commands) or implement command batching via Redis pipelines.

**No queue size cap per session:**
- Current capacity: Unbounded.
- Limit: `api/schedule/push.js` merges incoming tweets into existing queue with no cap. A user could accumulate thousands of tweets in KV if they repeatedly generate and schedule without the cron posting them (e.g., `CRON_SECRET` not set in dev).
- Scaling path: Enforce `merged.length <= 100` before writing back to KV.

---

## Dependencies at Risk

**`express` v5 (release candidate):**
- Risk: `package.json` depends on `express: ^5.2.1`. Express 5 is not yet at stable release; the `^` range will pull in breaking patch versions if Express 5.x ships breaking changes before a stable tag.
- Impact: `server.js` (the local dev proxy) could break on `npm install` after an upstream Express 5.x release.
- Migration plan: Pin to `express: 5.2.1` (exact) until Express 5 reaches stable, then re-evaluate upgrade policy.

**`vite: ^7.2.4` and `vitest: ^4.1.4` — major version pinning risk:**
- Risk: Both use `^` which allows minor and patch upgrades. Vite 7 and Vitest 4 are very recent major versions; the ecosystem (plugins, config APIs) can shift between minor versions.
- Impact: `vite.config.js` and `eslint.config.js` configurations may silently break on a `npm install` in CI.
- Migration plan: Pin to exact versions in `package-lock.json` (already done) but ensure `npm ci` is used in CI (it is — `.github/workflows/ci.yml` line 21).

---

## Missing Critical Features

**No test coverage for any API route handlers:**
- Problem: `api/auth/x/callback.js`, `api/auth/x/connect.js`, `api/auth/x/disconnect.js`, `api/auth/x/status.js`, `api/schedule/push.js`, `api/schedule/status.js`, and `api/cron/post-tweets.js` have zero test coverage. The OAuth callback flow, token exchange, queue push logic, and cron posting loop are all untested.
- Blocks: Confidence in deploying changes to the scheduling pipeline; inability to catch regressions in auth flow.

**No error recovery if generation partially fails:**
- Problem: If the initial `callClaude(prompt, { maxTokens: 12000 })` in `src/App.jsx` line 141 returns fewer than 15 tweets (Claude outputs partial JSON), the entire generation fails with "Expected 15 tweets, got N" and routes to the error screen. There is no partial recovery — the user must retry the entire 15-tweet generation.
- Blocks: Resilience for users on slow connections or during Anthropic rate-limit events.

**No persistent draft saving between browser sessions:**
- Problem: Generated tweets exist only in React state and are lost on page refresh. The `PREV_WEEK_KEY` localStorage entry saves only slim tweet metadata (day, slot, fullText) for context injection, not the full editable draft state. A user who generates a week, edits several tweets, then accidentally closes the tab loses all work.
- Blocks: User trust and workflow reliability.

---

## Test Coverage Gaps

**API route handlers are completely untested:**
- What's not tested: All seven API route files under `api/` — OAuth flow, token storage, queue push, queue status, cron posting.
- Files: `api/auth/x/callback.js`, `api/auth/x/connect.js`, `api/auth/x/disconnect.js`, `api/auth/x/status.js`, `api/schedule/push.js`, `api/schedule/status.js`, `api/cron/post-tweets.js`
- Risk: Silent regressions in the scheduling pipeline, token refresh logic, or PKCE state handling will not be caught before production.
- Priority: High

**`src/lib/trends.js` `getTrendsForProfile()` is untested:**
- What's not tested: Profile keyword matching, scoring, and top-7 selection.
- Files: `src/lib/trends.js`
- Risk: Low (static data, simple logic), but the matching algorithm could silently return no relevant trends if profile keyword format changes.
- Priority: Low

**Template types without structural defect tests:**
- What's not tested: `prediction`, `common_mistake`, `myth_vs_truth`, `contrarian_insight`, `contrarian_tech`, `agree_disagree` template names in `hasTweetDefect`.
- Files: `src/lib/ai.js` (lines 50-127), `src/lib/__tests__/lib.test.js`
- Risk: Structural defects in these template types will not be caught; defective tweets will reach users without the amber "Incomplete generation" banner.
- Priority: Medium

**No test for the `enforceCharLimit` floor behavior:**
- What's not tested: The `floor = limit * 0.35` guard — if no clean boundary exists above the floor, the function falls back to word-boundary trim. There is no test verifying the floor prevents cutting in the first 35% of the budget.
- Files: `src/lib/ai.js` (lines 134-166)
- Risk: Low — logic is straightforward — but the floor constant could be changed without knowing the impact.
- Priority: Low

**No component-level or E2E tests:**
- What's not tested: React components (`SetupForm`, `WeeklyPlanner`, `TweetCard`, `TweetEditor`, `ScheduleReview`), user interaction flows, and the full generation → approve → schedule pipeline.
- Files: `src/components/`
- Risk: UI regressions (broken approve flow, time picker not updating `scheduledAt`, TweetEditor save silently discarding score) go undetected until manual testing.
- Priority: Medium

---

*Concerns audit: 2026-05-05*
