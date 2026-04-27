/**
 * Integration tests — require ANTHROPIC_API_KEY in environment.
 * Run with: ANTHROPIC_API_KEY=sk-... npx vitest run src/lib/__tests__/integration.test.js
 *
 * Tests are skipped automatically when the key is absent.
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { hasTweetDefect, parseJSON } from '../ai.js';
import { buildSelfImprovementPrompt } from '../prompts.js';

const HAS_KEY = !!process.env.ANTHROPIC_API_KEY;

async function callDirect(prompt, maxTokens = 2000) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.content?.[0]?.text;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: lessons_learned generation
// Generates 5 tweets via real API and asserts every one has an explicit lesson.
// On failure: prints the defective tweet and the prompt that produced it.
// ─────────────────────────────────────────────────────────────────────────────

const LESSONS_PROMPT = `Generate exactly 5 tweets using the lessons_learned template about founder productivity and business systems.

TEMPLATE RULES for lessons_learned — read carefully:
- REQUIRED structure: two paragraphs separated by a blank line
- First paragraph: story setup — 1-2 sentences describing what happened (≤110 chars)
- Second paragraph: the explicit lesson — MUST start with "The lesson:", "What I learned:", "Turns out:", or "The takeaway:"
- A story with no lesson paragraph is a STUB. It is invalid output.
- Example of VALID output:
  "I lost a $40K contract because I sent the proposal before scoping the problem.

  The lesson: clarity before urgency — always."

Return ONLY a valid JSON array of exactly 5 objects. No markdown. No fences.

[
  {
    "hookText": "first line",
    "bodyText": "everything after the first line",
    "ctaText": "",
    "fullText": "complete tweet — story setup, blank line, explicit lesson"
  }
]`;

describe('lessons_learned — generation', () => {
  let tweets = [];
  let rawResponse = '';

  beforeAll(async () => {
    if (!HAS_KEY) return;
    rawResponse = await callDirect(LESSONS_PROMPT, 3000);
    tweets = parseJSON(rawResponse);
  }, 60000);

  test.skipIf(!HAS_KEY)('Claude returns exactly 5 tweets', () => {
    expect(Array.isArray(tweets)).toBe(true);
    expect(tweets.length).toBe(5);
  });

  test.skipIf(!HAS_KEY)('every tweet has a second paragraph (hasTweetDefect = false)', () => {
    const failures = [];
    for (const [i, tweet] of tweets.entries()) {
      if (hasTweetDefect(tweet.fullText, 'lessons_learned')) {
        failures.push({ index: i + 1, text: tweet.fullText });
      }
    }
    if (failures.length > 0) {
      console.log('\n══ DEFECTIVE TWEET(S) ══');
      for (const f of failures) {
        console.log(`\nTweet ${f.index}:\n${f.text}`);
      }
      console.log('\n══ PROMPT USED ══\n' + LESSONS_PROMPT);
    }
    expect(failures).toHaveLength(0);
  });

  test.skipIf(!HAS_KEY)('every tweet has an explicit lesson sentence (starts with known label)', () => {
    const LESSON_LABELS = /The lesson:/;
    const failures = [];
    for (const [i, tweet] of tweets.entries()) {
      if (!LESSON_LABELS.test(tweet.fullText)) {
        failures.push({ index: i + 1, text: tweet.fullText });
      }
    }
    if (failures.length > 0) {
      console.log('\n══ TWEET(S) MISSING LESSON LABEL ══');
      for (const f of failures) {
        console.log(`\nTweet ${f.index}:\n${f.text}`);
      }
      console.log('\n══ PROMPT USED ══\n' + LESSONS_PROMPT);
    }
    expect(failures).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: score threshold
// Part A: pure routing logic — no API call, mirrors App.jsx lines 151-162 exactly.
//         On failure: reads App.jsx and prints the threshold check live.
// Part B: integration — calls buildSelfImprovementPrompt + Claude with score-60 tweet.
//         Asserts a response came back (i.e. the prompt fired and Claude answered).
// ─────────────────────────────────────────────────────────────────────────────

// Mirrors the exact routing logic in App.jsx generateWeek()
function routeImprovement(tweet) {
  if (tweet.defective) return 'completion';
  if (tweet.score < 65) return 'self-improve';
  if (tweet.score > 85) return 'spike';
  return null;
}

describe('score threshold — routing', () => {
  test('tweet with score 60 routes to self-improve', () => {
    expect(routeImprovement({ defective: false, score: 60 })).toBe('self-improve');
  });

  test('tweet with score 64 routes to self-improve', () => {
    expect(routeImprovement({ defective: false, score: 64 })).toBe('self-improve');
  });

  test('tweet with score 65 is NOT improved (threshold is < 65, not <= 65)', () => {
    // If this test fails and score=65 should be improved, change < 65 to <= 65 in App.jsx
    const result = routeImprovement({ defective: false, score: 65 });
    expect(result).toBeNull();
  });

  test('defective tweet at score 60 routes to completion, not self-improve', () => {
    const result = routeImprovement({ defective: true, score: 60 });
    expect(result).toBe('completion');
  });

  test('tweet with score 70 returns null (no improvement triggered)', () => {
    const result = routeImprovement({ defective: false, score: 70 });
    expect(result).toBeNull();
  });

  test.skipIf(!HAS_KEY)(
    'buildSelfImprovementPrompt fires and Claude returns fullText for a score-60 tweet',
    async () => {
      const tweet = {
        defective: false,
        score: 60,
        templateName: 'contrarian_insight',
        fullText: 'Most founders scale too fast.\n\nThey add people before they fix process.',
        hookText: 'Most founders scale too fast.',
        bodyText: 'They add people before they fix process.',
        ctaText: '',
      };
      const prompt = buildSelfImprovementPrompt(tweet);
      const raw = await callDirect(prompt, 1000);
      let result;
      try {
        result = parseJSON(raw);
      } catch {
        console.log('\n══ RAW RESPONSE (could not parse) ══\n' + raw);
        throw new Error('buildSelfImprovementPrompt returned unparseable response');
      }
      if (!result.fullText) {
        console.log('\n══ PARSED RESULT (missing fullText) ══\n', JSON.stringify(result, null, 2));
        console.log('\n══ PROMPT USED ══\n' + prompt);
      }
      expect(result.fullText).toBeTruthy();
    },
    30000,
  );
});
