import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { hasTweetDefect, enforceCharLimit, parseJSON } from '../ai.js';
import { assignSchedule, getNextMonday } from '../scheduler.js';
import { applyCtasToTweets, resetCtaTracking } from '../ctas.js';

beforeEach(() => resetCtaTracking());

// ─── Failure 1: DAY_OFFSETS[4] applies -10 HOURS not -10 minutes ─────────────
// Symptom: Friday tweets schedule at 2:15 AM, 5:10 AM, 7:40 AM instead of noon–evening
// Root cause: DAY_OFFSETS[4] = [-10, 0] — first element is hourOff, not minOff

describe('assignSchedule — Day 5 (Friday) offset bug', () => {
  const MONDAY = '2026-04-21';

  test('Tweet 1 (noon slot) on Friday is scheduled in the PM', () => {
    const [result] = assignSchedule([{ dayNumber: 5, tweetOrder: 1 }], MONDAY, 'UTC');
    // Base is 12:15. With [-10,0] that's 12:15 - 10h = 2:15 AM → wrong
    // Should be around 12:05 PM (if offset were [0,-10])
    expect(result.displayTime).toMatch(/PM$/);
  });

  test('Tweet 1 UTC hour on Friday is 11–18 (daytime), not 0–9 (early AM)', () => {
    const [result] = assignSchedule([{ dayNumber: 5, tweetOrder: 1 }], MONDAY, 'UTC');
    const hour = new Date(result.scheduledAt).getUTCHours();
    expect(hour).toBeGreaterThanOrEqual(11);
    expect(hour).toBeLessThanOrEqual(18);
  });

  test('All three Friday tweets are in daytime hours (not pre-dawn)', () => {
    const tweets = [1, 2, 3].map(tweetOrder => ({ dayNumber: 5, tweetOrder }));
    const results = assignSchedule(tweets, MONDAY, 'UTC');
    for (const r of results) {
      const hour = new Date(r.scheduledAt).getUTCHours();
      expect(hour).toBeGreaterThanOrEqual(9); // Never before 9 AM
    }
  });
});

// ─── Failure 2: hasTweetDefect \s\d+$ false-positives on valid endings ────────
// Symptom: tweets deliberately ending with a count ("Just 3", "down to 2")
//          are flagged as defective and routed to the completion pass unnecessarily

describe('hasTweetDefect — number-ending false positive', () => {
  test('tweet intentionally ending with a count number is NOT defective', () => {
    // A complete thought that happens to end with a number
    const valid = 'Solo businesses don\'t need a team of 10.\nNot 5 systems. Not 3. Just you plus leverage.';
    // \s\d+$ matches " 3" at the end → currently returns true (false positive)
    expect(hasTweetDefect(valid)).toBe(false);
  });

  test('genuinely truncated tweet ending with bare number IS defective', () => {
    const truncated = 'Output doesn\'t collapse from fewer hours — it collapses from unrecovered decisions for 3';
    expect(hasTweetDefect(truncated)).toBe(true);
  });

  test('tweet ending with number followed by period is NOT defective', () => {
    // Period after the number means it is a complete sentence
    expect(hasTweetDefect('Not 10. Not 5. Just 3.')).toBe(false);
  });
});

// ─── Failure 3: parseJSON greedy \[[\s\S]*\] fails on prose with brackets ─────
// Symptom: if Claude prefixes JSON with a note containing square brackets,
//          the regex spans from the first "[" to the last "]",
//          capturing invalid text → JSON.parse throws uncaught, generation fails

describe('parseJSON — greedy bracket matching', () => {
  test('parses correctly when prose contains square brackets before JSON array', () => {
    const response = `Here is the output [as requested]:\n\n[{"hookText":"hook","bodyText":"body","ctaText":"","fullText":"tweet"}]`;
    // Greedy match: "[as requested]:\n\n[{..." → not valid JSON → uncaught throw
    expect(() => parseJSON(response)).not.toThrow();
    const result = parseJSON(response);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].hookText).toBe('hook');
  });

  test('parses correctly when response has [note] before JSON object', () => {
    const response = `Note [see above]: the tweet has been improved.\n\n{"hookText":"hook","bodyText":"body","ctaText":"","fullText":"tweet"}`;
    expect(() => parseJSON(response)).not.toThrow();
    const result = parseJSON(response);
    expect(result.hookText).toBe('hook');
  });

  test('clean JSON array with no surrounding prose still works', () => {
    const clean = `[{"hookText":"h","bodyText":"b","ctaText":"","fullText":"f"}]`;
    const result = parseJSON(clean);
    expect(result[0].hookText).toBe('h');
  });
});

// ─── Failure 9: framework_3_step false positive + ctas.js second defect source ─
// framework_3_step: /^\d+\./gm never matched "Step N:" format → always 0 → always defective
// ctas.js: hasEmptyBody/hasEmptyListItem were a second defect gate that diverged from
//          hasTweetDefect. A colon stub with partial body passed hasEmptyBody (2 lines,
//          last didn't end with ':') → defective overwritten to false via ...tweet spread.
// Fix: framework_3_step now counts "Step N:" labels too.
//      applyCtasToTweets replaced hasEmptyBody/hasEmptyListItem with hasTweetDefect.

describe('hasTweetDefect — framework_3_step Step N: format', () => {
  test('framework_3_step with 3 "Step N:" labels is NOT defective', () => {
    const valid = '3 steps to ship a workflow that doesn\'t break.\n\nStep 1: Map the manual version first\nStep 2: Build one trigger, run clean for 5 days\nStep 3: Add a Slack alert on failure before calling it done';
    expect(hasTweetDefect(valid, 'framework_3_step')).toBe(false);
  });

  test('framework_3_step with only 2 "Step N:" labels IS defective', () => {
    const stub = '3 steps to ship a workflow.\n\nStep 1: Map the manual version\nStep 2: Build one trigger';
    expect(hasTweetDefect(stub, 'framework_3_step')).toBe(true);
  });

  test('framework_3_step with 3 numbered "1." items still works', () => {
    const valid = 'Build systems that outlast the founder.\n\n1. Document the decision\n2. Automate the trigger\n3. Delegate the follow-up';
    expect(hasTweetDefect(valid, 'framework_3_step')).toBe(false);
  });
});

describe('applyCtasToTweets — single source of truth via hasTweetDefect', () => {
  test('simple_process colon stub is flagged defective and gets no CTA', () => {
    const tweet = { id: 't1', tweetType: 'primary_educational', templateName: 'simple_process', fullText: 'Ship a validated offer in 5 days instead:' };
    const [result] = applyCtasToTweets([tweet]);
    expect(result.defective).toBe(true);
    expect(result.ctaText).toBe('');
  });

  test('simple_process colon stub with partial second paragraph is still defective', () => {
    // hasEmptyBody would have passed this (2 lines, last not ending ":") — hasTweetDefect catches it
    const tweet = { id: 't2', tweetType: 'primary_educational', templateName: 'simple_process', fullText: 'Ship a validated offer in 5 days instead:\n\nHere is how to do it' };
    const [result] = applyCtasToTweets([tweet]);
    expect(result.defective).toBe(true);
    expect(result.ctaText).toBe('');
  });

  test('complete myth_vs_truth is NOT defective and receives a CTA', () => {
    const tweet = { id: 't3', tweetType: 'primary_educational', templateName: 'myth_vs_truth', fullText: 'Your 47-node workflow isn\'t powerful. It\'s a time bomb.\n\nMyth → More integrations = more power\nTruth → Every node is a failure point you\'ll debug at 2am\n\nSimplicity scales. Complexity accumulates debt.' };
    const [result] = applyCtasToTweets([tweet]);
    expect(result.defective).toBe(false);
    expect(result.ctaText.length).toBeGreaterThan(0);
  });
});

// ─── Failure 4: stripTrailingCta \?$ strips legitimate content ───────────────
// Symptom: any last line ending with "?" is stripped,
//          including rhetorical questions that are part of the tweet body

describe('applyCtasToTweets — question mark stripping content', () => {
  test('preserves last line that is content ending in "?" (not a generic CTA)', () => {
    const tweet = {
      id: 't1',
      tweetType: 'primary_educational',
      fullText: 'Automation doesn\'t fix broken processes.\n\nIt amplifies them.\n\nStill think the tool is the problem?',
    };
    const [result] = applyCtasToTweets([tweet]);
    // "Still think the tool is the problem?" ends with ? → \?$ strips it
    expect(result.fullText).toContain('Still think the tool is the problem?');
  });

  test('does strip a clearly generic engagement CTA ending with "?"', () => {
    const tweet = {
      id: 't2',
      tweetType: 'engagement',
      fullText: 'Your content is getting ignored.\n\nHere\'s why.\n\nAgree or disagree?',
    };
    const [result] = applyCtasToTweets([tweet]);
    // "Agree or disagree?" — matches the explicit "agree|disagree" pattern AND \?$
    // This one SHOULD be stripped
    expect(result.fullText).not.toContain('Agree or disagree?');
  });
});

// ─── Failure 8: before_after New: missing, hot_take stub, simple_process > 3 items ──
// Issue 1: before_after missing "New:" block — emoji regex can miss Unicode variants;
//          backup label check on "New:" text added.
// Issue 2: hot_take stub (< 3 sentences) scores high on hook quality alone.
// Issue 3: simple_process with 5 items scores 58 because > 280 chars triggers clarity
//          penalty; self-improvement keeps structure, score never escapes.
//          Fix: simple_process with ≠ 3 items is defective → routes to completion.

describe('hasTweetDefect — before_after New: label, hot_take sentences, simple_process item count', () => {
  // before_after — "New:" label check
  test('before_after missing New: block IS defective (label check)', () => {
    const missing = 'Your Q3 decisions are set by what you read in Q2.\n\nOld:\n❌ Read on demand\n❌ Skim social feeds\n❌ No synthesis block';
    expect(hasTweetDefect(missing, 'before_after')).toBe(true);
  });

  test('before_after with both Old: and New: blocks is NOT defective', () => {
    const complete = 'Your Q3 decisions are set by what you read in Q2.\n\nOld:\n❌ Read on demand\n❌ Skim social feeds\n❌ No synthesis block\n\nNew:\n✅ Scheduled reading block\n✅ One synthesis note per book\n✅ Ideas filed before Monday\n\nInput quality drives output quality.';
    expect(hasTweetDefect(complete, 'before_after')).toBe(false);
  });

  // hot_take — minimum 3 sentences
  test('hot_take with 1 sentence IS defective', () => {
    const stub = 'A polished SOP is still a broken process — just better documented.';
    expect(hasTweetDefect(stub, 'hot_take')).toBe(true);
  });

  test('hot_take with 2 sentences IS defective', () => {
    const stub = 'A polished SOP is still a broken process — just better documented.\n\nFounders are feeding AI their existing workflows and calling it optimization.';
    expect(hasTweetDefect(stub, 'hot_take')).toBe(true);
  });

  test('hot_take with 3 sentences is NOT defective', () => {
    const complete = 'A polished SOP is still a broken process — just better documented.\n\nFounders are feeding AI their existing workflows and calling it optimization.\n\nClean formatting on a broken process is still a broken process.';
    expect(hasTweetDefect(complete, 'hot_take')).toBe(false);
  });

  test('hot_take with 4 sentences is NOT defective', () => {
    const complete = 'A polished SOP is still a broken process — just better documented.\n\nFounders are feeding AI their existing workflows and calling it optimization. The output is clean. The formatting is crisp.';
    expect(hasTweetDefect(complete, 'hot_take')).toBe(false);
  });

  // simple_process — exactly 3 items required
  test('simple_process with 5 items is NOT defective by per-number check (items 1–3 are present)', () => {
    const fiveItems = 'One-person businesses hitting $1M don\'t manage time — they manage energy.\n\n1. Schedule peak-hour work\n2. Batch shallow work\n3. Protect recovery time\n4. Say no to energy drains\n5. Audit weekly';
    expect(hasTweetDefect(fiveItems, 'simple_process')).toBe(false);
  });

  test('simple_process with 2 items IS defective', () => {
    const twoItems = 'Three steps to kill a bad idea fast.\n\n1. Write it in one sentence\n2. Name one person who would pay today';
    expect(hasTweetDefect(twoItems, 'simple_process')).toBe(true);
  });

  test('simple_process with exactly 3 items is NOT defective', () => {
    const threeItems = 'Three steps to kill a bad idea fast.\n\n1. Write it in one sentence\n2. Name one person who would pay today\n3. Give it 48 hours — not a month';
    expect(hasTweetDefect(threeItems, 'simple_process')).toBe(false);
  });
});

// ─── Failure 6: Tweets truncated mid-sentence (missing terminal punctuation) ──
// Symptom: Day 5 Slot 3 (agree_disagree) ends with "customers they've never spoken"
// Root cause: max_tokens budget exhausted mid-JSON; terminal char is a word, not . ! ?
// Fix: hasTweetDefect now checks last char for terminal punctuation (except list formats)

describe('hasTweetDefect — terminal punctuation validation', () => {
  // The exact truncation from the bug report
  test('Day 5 Slot 3 bug: agree_disagree tweet cut mid-sentence IS defective', () => {
    const truncated = "Controversial take: The best customers they've never spoken";
    expect(hasTweetDefect(truncated, 'agree_disagree')).toBe(true);
  });

  test('tweet ending with period is NOT defective', () => {
    const valid = 'Most founders automate too late.\n\nThe bottleneck is always the process, not the tool.';
    expect(hasTweetDefect(valid, 'contrarian_insight')).toBe(false);
  });

  test('tweet ending with exclamation mark is NOT defective', () => {
    const valid = 'Stop hiring for culture fit.\n\nHire for complement instead!';
    expect(hasTweetDefect(valid, 'contrarian_insight')).toBe(false);
  });

  test('tweet ending with question mark is NOT defective', () => {
    const valid = 'You optimise your funnel.\n\nBut not your sleep?';
    expect(hasTweetDefect(valid, 'contrarian_insight')).toBe(false);
  });

  test('tweet ending with a plain word (no punctuation) IS defective', () => {
    const truncated = 'The real cost of bad hiring is invisible for months\n\nBecause it shows up as slow';
    expect(hasTweetDefect(truncated, 'contrarian_insight')).toBe(true);
  });

  // List formats legitimately end with a list item — no terminal punctuation required
  test('simple_process last item without period is NOT defective', () => {
    const valid = 'Three steps to sustainable revenue.\n\n1. Build the process\n2. Automate the repeat\n3. Delegate the rest';
    expect(hasTweetDefect(valid, 'simple_process')).toBe(false);
  });

  test('framework_3_step last step without period is NOT defective', () => {
    // hasTweetDefect validates numbered items via /^\d+\./gm — use 1./2./3. format
    const valid = 'Build systems that outlast the founder.\n\n1. Document the decision\n2. Automate the trigger\n3. Delegate the follow-up';
    expect(hasTweetDefect(valid, 'framework_3_step')).toBe(false);
  });

  test('checklist last bullet without period is NOT defective', () => {
    const valid = 'Stop reacting. Start protecting.\n\n☑ Morning block locked\n☑ Async by default\n☑ No meetings before noon\n☑ Deep work before inbox';
    expect(hasTweetDefect(valid, 'checklist')).toBe(false);
  });

  // Simulates validation over both the initial generation pass and the improvement pass
  test('fails if any tweet in a simulated generation or improvement run is truncated', () => {
    const initialGeneration = [
      { fullText: 'Automation doesn\'t fix broken processes.\n\nIt amplifies them.', templateName: 'contrarian_insight' },
      { fullText: 'Myth → AI replaces the founder.\nTruth → AI replaces founders who won\'t adapt.', templateName: 'myth_vs_truth' },
      { fullText: 'Old:\n❌ Manual\n❌ Reactive\n❌ Slow\n\nNew:\n✅ Automated\n✅ Proactive\n✅ Fast\n\nSame hours. Better output.', templateName: 'before_after' },
    ];
    const improvementPass = [
      { fullText: 'The founder who ships slowest is rarely the one who works least.', templateName: 'contrarian_insight' },
      { fullText: 'Recovery isn\'t earned.\n\nIt\'s scheduled. Founders who treat rest as optional are borrowing against decisions they\'ll have to make tomorrow.', templateName: 'contrarian_tech' },
      { fullText: 'Most SaaS tools promise leverage.\n\nFew deliver it. The ones that do have one thing in common: they remove a decision, not just a task.', templateName: 'agree_disagree' },
    ];

    for (const run of [initialGeneration, improvementPass]) {
      for (const t of run) {
        expect(hasTweetDefect(t.fullText, t.templateName)).toBe(false);
      }
    }
  });

  // Simulated run where one tweet is truncated — must fail
  test('a truncated tweet in a generation run causes the run to fail', () => {
    const runWithTruncation = [
      { fullText: 'Automation doesn\'t fix broken processes.\n\nIt amplifies them.', templateName: 'contrarian_insight' },
      { fullText: "The best customers they've never spoken", templateName: 'agree_disagree' }, // truncated
    ];

    const defective = runWithTruncation.filter(t => hasTweetDefect(t.fullText, t.templateName));
    expect(defective.length).toBeGreaterThan(0);
  });
});

// ─── Failure 7: hasTweetDefect misses lessons_learned stub and colon stubs ────
// Symptom: lessons_learned tweets with no payoff and checklist/simple_process
//          stubs (hook + ":" with no items) scored 78–80 because hasTweetDefect
//          returned false — the structural gap wasn't checked.

describe('hasTweetDefect — lessons_learned, checklist stub, simple_process stub', () => {
  // lessons_learned: requires a second paragraph (the lesson/payoff)
  test('lessons_learned with no second paragraph IS defective', () => {
    const stub = 'I lost a $40K contract because I sent the proposal too fast.';
    expect(hasTweetDefect(stub, 'lessons_learned')).toBe(true);
  });

  test('lessons_learned with "The lesson:" line is NOT defective', () => {
    const complete = 'I lost a $40K contract because I sent the proposal too fast.\n\nThe lesson: urgency without clarity is just noise.';
    expect(hasTweetDefect(complete, 'lessons_learned')).toBe(false);
  });

  test('lessons_learned with second paragraph (any complete sentence) is NOT defective', () => {
    const noLabel = 'I lost a $40K contract because I sent the proposal too fast.\n\nUrgency without clarity is just noise.';
    expect(hasTweetDefect(noLabel, 'lessons_learned')).toBe(false);
  });

  test('lessons_learned with second paragraph ending in period is NOT defective', () => {
    const shortForm = 'I lost a $40K contract because I sent the proposal too fast.\n\nLesson: urgency without clarity is just noise.';
    expect(hasTweetDefect(shortForm, 'lessons_learned')).toBe(false);
  });

  test('lessons_learned with empty second paragraph IS defective', () => {
    const emptyLesson = 'I lost a $40K contract because I sent the proposal too fast.\n\n';
    expect(hasTweetDefect(emptyLesson, 'lessons_learned')).toBe(true);
  });

  // checklist: must have at least 3 ☑ bullets — not 0, not 1, not 2
  test('checklist with 0 ☑ bullets IS defective', () => {
    const stub = 'Your intake form is doing nothing.\n\nHere\'s what it should do:';
    expect(hasTweetDefect(stub, 'checklist')).toBe(true);
  });

  test('checklist with only 1 ☑ bullet IS defective', () => {
    const stub = 'Your intake form is doing nothing.\n\n☑ Qualifies budget before the call';
    expect(hasTweetDefect(stub, 'checklist')).toBe(true);
  });

  test('checklist with only 2 ☑ bullets IS defective', () => {
    const stub = 'Your intake form is doing nothing.\n\n☑ Qualifies budget before the call\n☑ Filters out time-wasters';
    expect(hasTweetDefect(stub, 'checklist')).toBe(true);
  });

  test('checklist with only 3 ☑ bullets IS defective (minimum is now 4)', () => {
    const threeOnly = 'Your intake form is doing nothing.\n\n☑ Qualifies budget before the call\n☑ Filters out time-wasters\n☑ Sets expectation before they book';
    expect(hasTweetDefect(threeOnly, 'checklist')).toBe(true);
  });

  test('checklist with 4 ☑ bullets is NOT defective', () => {
    const complete = 'Your intake form is doing nothing.\n\n☑ Qualifies budget before the call\n☑ Filters out time-wasters\n☑ Sets expectation before they book\n☑ Confirms decision-maker is on the call';
    expect(hasTweetDefect(complete, 'checklist')).toBe(false);
  });

  // simple_process stub: hook line ends with ":" but no numbered items follow
  test('simple_process hook + colon with no numbered items IS defective', () => {
    const stub = 'Three ways to kill a bad idea fast:\n';
    expect(hasTweetDefect(stub, 'simple_process')).toBe(true);
  });

  test('simple_process with hook + colon AND 3 numbered items is NOT defective', () => {
    const complete = 'Three ways to kill a bad idea fast:\n\n1. Write it in one sentence\n2. Name someone who would pay today\n3. Give it 48 hours — not a month';
    expect(hasTweetDefect(complete, 'simple_process')).toBe(false);
  });
});

// ─── prediction minimum sentences + hot_take dangling tease ──────────────────
// prediction: no structural check existed — a 1-sentence stub passed undetected
// hot_take: 3-sentence minimum didn't catch a 4-sentence tweet whose final line
//   was "The real question isn't what AI replaces." — a setup without a payoff

describe('hasTweetDefect — prediction minimum and hot_take dangling tease', () => {
  test('prediction with 1 sentence IS defective', () => {
    const stub = 'By 2027, founder mental health will be a board metric.';
    expect(hasTweetDefect(stub, 'prediction')).toBe(true);
  });

  test('prediction with 2 sentences IS defective', () => {
    const stub = 'By 2027, founder mental health will be a board metric.\n\nThe grind narrative is collapsing.';
    expect(hasTweetDefect(stub, 'prediction')).toBe(true);
  });

  test('prediction with 3 sentences is NOT defective', () => {
    const complete = 'By 2027, founder mental health will be a board metric.\n\nThe grind narrative is collapsing. Investors are watching burnout sink otherwise fundable companies.';
    expect(hasTweetDefect(complete, 'prediction')).toBe(false);
  });

  test('hot_take ending with "The real X isn\'t [interrogative]" IS defective', () => {
    const tease = 'AI agents are not replacing junior roles. They\'re exposing bad senior ones.\n\nIf your team needed a junior hire to do work that a Claude agent now handles in 20 minutes — that work was never strategic. The real question isn\'t what AI replaces.';
    expect(hasTweetDefect(tease, 'hot_take')).toBe(true);
  });

  test('hot_take ending with a complete payoff statement is NOT defective', () => {
    const complete = 'AI agents are not replacing junior roles. They\'re exposing bad senior ones.\n\nThe work that disappeared wasn\'t strategic. The shift isn\'t fewer jobs. It\'s higher bars.';
    expect(hasTweetDefect(complete, 'hot_take')).toBe(false);
  });

  test('"The real X isn\'t [interrogative]" is caught regardless of templateName', () => {
    const tease = 'Founders chase tools. The real question isn\'t what stack you use.';
    expect(hasTweetDefect(tease, 'contrarian_insight')).toBe(true);
  });

  test('"The real X isn\'t [noun phrase]" is NOT flagged — a concrete contrast is a valid ending', () => {
    const valid = 'Burnout isn\'t a wellness issue. It\'s a P&L problem.\n\nDecision quality is your most leveraged asset. The real failure isn\'t exhaustion.';
    expect(hasTweetDefect(valid, 'hot_take')).toBe(false);
  });
});

// ─── Failure 5: getNextMonday skips current week when called on Monday ────────
// Symptom: user opens app on Monday morning and gets content scheduled
//          for the FOLLOWING Monday (+7 days) instead of this week

describe('getNextMonday — Monday scheduling gap', () => {
  afterEach(() => vi.useRealTimers());

  test('called on a Monday returns today (0 days away — schedules current week)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T09:00:00')); // Monday
    const result = getNextMonday();
    const diff = (new Date(result) - new Date('2026-04-20')) / (1000 * 60 * 60 * 24);
    expect(diff).toBe(0);
  });

  test('called on a Tuesday returns the coming Monday (6 days away)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-21T09:00:00')); // Tuesday
    const result = getNextMonday();
    const diff = Math.round((new Date(result) - new Date('2026-04-21')) / (1000 * 60 * 60 * 24));
    expect(diff).toBe(6);
  });

  test('called on a Sunday returns the coming Monday (1 day away)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-19T09:00:00')); // Sunday
    const result = getNextMonday();
    const diff = Math.round((new Date(result) - new Date('2026-04-19')) / (1000 * 60 * 60 * 24));
    expect(diff).toBe(1);
  });
});
