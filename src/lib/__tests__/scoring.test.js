import { describe, test, expect } from 'vitest';
import { scoreTweet, getScoreLabel, scoreAllTweets } from '../scoring.js';

const PROFILE = {
  primaryTopic: 'solopreneur systems',
  secondaryTopic: 'founder productivity',
  tone: 'direct',
};

// ─── scoreTweet — hook strength (25 pts) ─────────────────────────────────────

describe('scoreTweet — hook strength', () => {
  test('strong keyword hook ≥20 chars → 25', () => {
    const { breakdown } = scoreTweet({
      hookText: 'Most founders make this mistake.',
      fullText: 'Most founders make this mistake.\n\nThey add people before process.',
      ctaText: '',
    }, PROFILE);
    expect(breakdown.hookStrength).toBe(25);
  });

  test('strong keyword hook <20 chars → 20', () => {
    const { breakdown } = scoreTweet({
      hookText: 'Stop this now.',
      fullText: 'Stop this now.\n\nYou are burning time on the wrong work.',
      ctaText: '',
    }, PROFILE);
    expect(breakdown.hookStrength).toBe(20);
  });

  test('structural pattern hook ($amount) ≥20 chars → 25', () => {
    const { breakdown } = scoreTweet({
      hookText: '$50K revenue in 90 days, zero ads.',
      fullText: '$50K revenue in 90 days, zero ads.\n\nHere is how the system works.',
      ctaText: '',
    }, PROFILE);
    expect(breakdown.hookStrength).toBe(25);
  });

  test('no strong hook, hook ≥15 chars → 15', () => {
    const { breakdown } = scoreTweet({
      hookText: 'Build a good process.',
      fullText: 'Build a good process.\n\nThen automate it.',
      ctaText: '',
    }, PROFILE);
    expect(breakdown.hookStrength).toBe(15);
  });

  test("keyword 'misleading' → 25", () => {
    const { breakdown } = scoreTweet({
      hookText: 'Stripe MRR is the most misleading metric a SaaS founder can celebrate.',
      fullText: 'Stripe MRR is the most misleading metric a SaaS founder can celebrate.\n\nNew MRR feels like traction.',
      ctaText: '',
    }, PROFILE);
    expect(breakdown.hookStrength).toBe(25);
  });

  test("keyword 'buried' → 25", () => {
    const { breakdown } = scoreTweet({
      hookText: 'Your best work is being buried under your busiest work.',
      fullText: 'Your best work is being buried under your busiest work.\n\nFix the calendar first.',
      ctaText: '',
    }, PROFILE);
    expect(breakdown.hookStrength).toBe(25);
  });

  test("pattern '^most \\w+' catches 'Most solo operators...' → 25", () => {
    const { breakdown } = scoreTweet({
      hookText: 'Most solo operators hitting $1M ARR built a job, not a business.',
      fullText: 'Most solo operators hitting $1M ARR built a job, not a business.\n\nThe revenue is real. So is the dependency.',
      ctaText: '',
    }, PROFILE);
    expect(breakdown.hookStrength).toBe(25);
  });

  test("pattern 'in N steps' anywhere in hook → 25", () => {
    const { breakdown } = scoreTweet({
      hookText: 'Turn a stalled lead into a closed deal in 3 steps.',
      fullText: 'Turn a stalled lead into a closed deal in 3 steps.\n\nStep 1: Capture the blocker\nStep 2: Draft the fix\nStep 3: Approve and send',
      ctaText: '',
    }, PROFILE);
    expect(breakdown.hookStrength).toBe(25);
  });

  test("pattern 'I used to / I should have' → 25", () => {
    const { breakdown } = scoreTweet({
      hookText: 'I used to protect my calendar. I should have protected my attention.',
      fullText: 'I used to protect my calendar. I should have protected my attention.\n\nThe lesson: schedule focus, not tasks.',
      ctaText: '',
    }, PROFILE);
    expect(breakdown.hookStrength).toBe(25);
  });

  test('no strong hook, hook <15 chars → 10', () => {
    const { breakdown } = scoreTweet({
      hookText: 'Quick tip.',
      fullText: 'Quick tip.\n\nAlways write it down.',
      ctaText: '',
    }, PROFILE);
    expect(breakdown.hookStrength).toBe(10);
  });
});

// ─── scoreTweet — clarity / character count (20 pts) ─────────────────────────

describe('scoreTweet — clarity', () => {
  function tweetOfLength(len) {
    return 'x'.repeat(len);
  }

  test('80–220 chars → 20', () => {
    const { breakdown } = scoreTweet({ hookText: '', fullText: tweetOfLength(150), ctaText: '' }, PROFILE);
    expect(breakdown.clarity).toBe(20);
  });

  test('221–280 chars → 17', () => {
    const { breakdown } = scoreTweet({ hookText: '', fullText: tweetOfLength(250), ctaText: '' }, PROFILE);
    expect(breakdown.clarity).toBe(17);
  });

  test('>280 chars (non-structured) → 8', () => {
    const { breakdown } = scoreTweet({ hookText: '', fullText: tweetOfLength(300), ctaText: '' }, PROFILE);
    expect(breakdown.clarity).toBe(8);
  });

  test('281–360 chars on a checklist template → 13 (gentler structured penalty)', () => {
    const { breakdown } = scoreTweet({ hookText: '', fullText: tweetOfLength(320), ctaText: '', templateName: 'checklist' }, PROFILE);
    expect(breakdown.clarity).toBe(13);
  });

  test('281–360 chars on a before_after template → 13', () => {
    const { breakdown } = scoreTweet({ hookText: '', fullText: tweetOfLength(340), ctaText: '', templateName: 'before_after' }, PROFILE);
    expect(breakdown.clarity).toBe(13);
  });

  test('>360 chars on a structured template still → 8', () => {
    const { breakdown } = scoreTweet({ hookText: '', fullText: tweetOfLength(370), ctaText: '', templateName: 'checklist' }, PROFILE);
    expect(breakdown.clarity).toBe(8);
  });

  test('<80 chars → 10', () => {
    const { breakdown } = scoreTweet({ hookText: '', fullText: tweetOfLength(50), ctaText: '' }, PROFILE);
    expect(breakdown.clarity).toBe(10);
  });
});

// ─── scoreTweet — topic relevance (15 pts) ───────────────────────────────────

describe('scoreTweet — topic relevance', () => {
  test('0 topic keywords → 5', () => {
    const { breakdown } = scoreTweet({
      hookText: '',
      fullText: 'Build good habits every day and ship consistently.',
      ctaText: '',
    }, PROFILE);
    expect(breakdown.topicRelevance).toBe(5);
  });

  test('1 topic keyword → 10', () => {
    const { breakdown } = scoreTweet({
      hookText: '',
      fullText: 'Your systems are the difference between revenue and chaos.',
      ctaText: '',
    }, PROFILE);
    expect(breakdown.topicRelevance).toBe(10);
  });

  test('2 topic keywords → 15', () => {
    const { breakdown } = scoreTweet({
      hookText: '',
      fullText: 'Your systems determine your productivity as a founder.',
      ctaText: '',
    }, PROFILE);
    expect(breakdown.topicRelevance).toBe(15);
  });

  test('3+ topic keywords → 15 (capped)', () => {
    const { breakdown } = scoreTweet({
      hookText: '',
      fullText: 'Solopreneur systems unlock founder productivity and better outcomes.',
      ctaText: '',
    }, PROFILE);
    expect(breakdown.topicRelevance).toBe(15);
  });
});

// ─── scoreTweet — engagement potential (15 pts) ──────────────────────────────

describe('scoreTweet — engagement potential', () => {
  test('open-loop CTA → 15', () => {
    const { breakdown } = scoreTweet({
      hookText: '',
      fullText: 'A complete idea.',
      ctaText: "Breaking this down on Thursday. Follow so you don't miss it.",
    }, PROFILE);
    expect(breakdown.engagementPotential).toBe(15);
  });

  test('engagement signal + question mark → 15', () => {
    const { breakdown } = scoreTweet({
      hookText: '',
      fullText: 'Automation beats manual work. Agree?',
      ctaText: '',
    }, PROFILE);
    expect(breakdown.engagementPotential).toBe(15);
  });

  test('engagement signal without question mark → 11', () => {
    const { breakdown } = scoreTweet({
      hookText: '',
      fullText: 'Tell me what you think about this approach.',
      ctaText: '',
    }, PROFILE);
    expect(breakdown.engagementPotential).toBe(11);
  });

  test('no engagement signals → 7', () => {
    const { breakdown } = scoreTweet({
      hookText: '',
      fullText: 'Build the system. Ship the product. Iterate.',
      ctaText: '',
    }, PROFILE);
    expect(breakdown.engagementPotential).toBe(7);
  });

  test('agree_disagree template without explicit engagement signals → 11', () => {
    const { breakdown } = scoreTweet({
      hookText: '',
      fullText: 'The 4-day work week is a diagnostic, not a reward. Founders who struggle with it have a structure problem.',
      ctaText: '',
      templateName: 'agree_disagree',
    }, PROFILE);
    expect(breakdown.engagementPotential).toBe(11);
  });

  test('hot_take template without explicit engagement signals → 11', () => {
    const { breakdown } = scoreTweet({
      hookText: '',
      fullText: 'Most solo operators built a job, not a business. The revenue is real. So is the dependency.',
      ctaText: '',
      templateName: 'hot_take',
    }, PROFILE);
    expect(breakdown.engagementPotential).toBe(11);
  });

  test('non-opinion template without engagement signals → 7', () => {
    const { breakdown } = scoreTweet({
      hookText: '',
      fullText: 'Build the system. Ship the product. Iterate.',
      ctaText: '',
      templateName: 'lessons_learned',
    }, PROFILE);
    expect(breakdown.engagementPotential).toBe(7);
  });
});

// ─── scoreTweet — tone fit (10 pts) ──────────────────────────────────────────

describe('scoreTweet — tone fit', () => {
  test('tone word appears in fullText → 10', () => {
    const { breakdown } = scoreTweet({
      hookText: '',
      fullText: 'Be direct with your clients from day one.',
      ctaText: '',
    }, PROFILE);
    expect(breakdown.toneFit).toBe(10);
  });

  test('tone word absent from fullText → 7', () => {
    const { breakdown } = scoreTweet({
      hookText: '',
      fullText: 'Ship fast, iterate faster, learn constantly.',
      ctaText: '',
    }, PROFILE);
    expect(breakdown.toneFit).toBe(7);
  });
});

// ─── scoreTweet — CTA quality (10 pts) ───────────────────────────────────────

describe('scoreTweet — CTA quality', () => {
  test('open-loop CTA pattern → 10', () => {
    const { breakdown } = scoreTweet({
      hookText: '',
      fullText: 'A complete thought.',
      ctaText: "Sharing the full breakdown on Thursday. Follow so you don't miss it.",
    }, PROFILE);
    expect(breakdown.ctaQuality).toBe(10);
  });

  test('empty CTA (intentional no-CTA) → 8', () => {
    const { breakdown } = scoreTweet({
      hookText: '',
      fullText: 'A complete thought.',
      ctaText: '',
    }, PROFILE);
    expect(breakdown.ctaQuality).toBe(8);
  });

  test('CTA 10–80 chars → 9', () => {
    const { breakdown } = scoreTweet({
      hookText: '',
      fullText: 'A complete thought.',
      ctaText: 'Save this for your next build session.',
    }, PROFILE);
    expect(breakdown.ctaQuality).toBe(9);
  });

  test('CTA 1–9 chars (too short, non-empty) → 6', () => {
    const { breakdown } = scoreTweet({
      hookText: '',
      fullText: 'A complete thought.',
      ctaText: 'RT this',
    }, PROFILE);
    expect(breakdown.ctaQuality).toBe(6);
  });
});

// ─── scoreTweet — specificity (5 pts) ────────────────────────────────────────

describe('scoreTweet — specificity', () => {
  test('percentage number in text → 5', () => {
    const { breakdown } = scoreTweet({
      hookText: '',
      fullText: 'Cut your admin work by 40% with one workflow.',
      ctaText: '',
    }, PROFILE);
    expect(breakdown.novelty).toBe(5);
  });

  test('dollar amount in text → 5', () => {
    const { breakdown } = scoreTweet({
      hookText: '',
      fullText: 'This saved me $3000 in the first month.',
      ctaText: '',
    }, PROFILE);
    expect(breakdown.novelty).toBe(5);
  });

  test('no specific numbers → 3', () => {
    const { breakdown } = scoreTweet({
      hookText: '',
      fullText: 'Build systems. Automate tasks. Scale output.',
      ctaText: '',
    }, PROFILE);
    expect(breakdown.novelty).toBe(3);
  });
});

// ─── scoreTweet — formatting bonus (up to +5) ────────────────────────────────

describe('scoreTweet — formatting bonus', () => {
  test('no formatting signals → 0', () => {
    const { breakdown } = scoreTweet({
      hookText: '',
      fullText: 'Build good habits. Ship consistently. Iterate often.',
      ctaText: '',
    }, PROFILE);
    expect(breakdown.formatting).toBe(0);
  });

  test('☑ emoji bullets count as formatting signal → 2', () => {
    const { breakdown } = scoreTweet({
      hookText: '',
      fullText: 'Your workflow has process debt.\n\n☑ No one owns decisions\n☑ Onboarding lives in heads\n☑ Tasks done twice\n☑ Slow feedback loops',
      ctaText: '',
    }, PROFILE);
    expect(breakdown.formatting).toBeGreaterThanOrEqual(2);
  });

  test('one formatting signal (numbered list) → 2', () => {
    const { breakdown } = scoreTweet({
      hookText: '',
      fullText: '1. Build the thing\n2. Ship it\n3. Iterate',
      ctaText: '',
    }, PROFILE);
    expect(breakdown.formatting).toBe(2);
  });

  test('two formatting signals → 4', () => {
    const { breakdown } = scoreTweet({
      hookText: '',
      fullText: '1. Build the thing\n→ ship it fast',
      ctaText: '',
    }, PROFILE);
    expect(breakdown.formatting).toBe(4);
  });

  test('three or more formatting signals → capped at 5', () => {
    const { breakdown } = scoreTweet({
      hookText: '',
      fullText: '1. Build it\n→ ship fast\n✅ done\nBefore: slow',
      ctaText: '',
    }, PROFILE);
    expect(breakdown.formatting).toBe(5);
  });
});

// ─── scoreTweet — weak second line penalty ───────────────────────────────────

describe('scoreTweet — weak second line penalty', () => {
  test('explanatory second line (no tension) caps score at 82', () => {
    // Construct a tweet that would score >82 without the penalty
    const { score } = scoreTweet({
      hookText: 'Most founders make this critical mistake.',
      fullText: [
        'Most founders make this critical mistake.',
        "Here's why it keeps happening: they skip the boring work.",
        'After 5 years building systems, I have tracked 50% of failures to this.',
        'Systems beat hustle. Directly and always.',
        'Agree?',
      ].join('\n\n'),
      ctaText: 'Save this. You will need it.',
    }, { ...PROFILE, primaryTopic: 'solopreneur systems founder productivity' });
    expect(score).toBeLessThanOrEqual(82);
  });

  test('strong second line (has tension) does not trigger penalty', () => {
    const { score: scoreWithTension } = scoreTweet({
      hookText: 'Most founders make this critical mistake.',
      fullText: [
        'Most founders make this critical mistake.',
        'The truth nobody admits: they never fixed the process.',
        'After 5 years I tracked 50% of failures to this.',
        'Systems beat hustle. Directly and always.',
        'Agree?',
      ].join('\n\n'),
      ctaText: 'Save this. You will need it.',
    }, { ...PROFILE, primaryTopic: 'solopreneur systems founder productivity' });

    const { score: scoreWithWeak } = scoreTweet({
      hookText: 'Most founders make this critical mistake.',
      fullText: [
        'Most founders make this critical mistake.',
        "Here's why it keeps happening: they skip the boring work.",
        'After 5 years I tracked 50% of failures to this.',
        'Systems beat hustle. Directly and always.',
        'Agree?',
      ].join('\n\n'),
      ctaText: 'Save this. You will need it.',
    }, { ...PROFILE, primaryTopic: 'solopreneur systems founder productivity' });

    expect(scoreWithTension).toBeGreaterThan(scoreWithWeak);
  });
});

// ─── scoreTweet — score clamping ─────────────────────────────────────────────

describe('scoreTweet — score clamping', () => {
  test('score never exceeds 100', () => {
    const { score } = scoreTweet({
      hookText: 'Most founders make this critical mistake with systems.',
      fullText: [
        'Most founders make this critical mistake with systems.',
        'The truth nobody admits: 80% of failures trace back to one broken process.',
        '1. Build direct systems\n2. Automate the repeat work\n3. Protect founder productivity',
        '→ solopreneur productivity beats hustle every time.',
        'Agree? Tell me below.',
      ].join('\n\n'),
      ctaText: "Breaking this down on Thursday. Follow so you don't miss it.",
    }, PROFILE);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('score never falls below 30', () => {
    const { score } = scoreTweet({
      hookText: '',
      fullText: 'Hi.',
      ctaText: '',
    }, PROFILE);
    expect(score).toBeGreaterThanOrEqual(30);
  });
});

// ─── getScoreLabel ────────────────────────────────────────────────────────────

describe('getScoreLabel', () => {
  test('≥88 → Excellent', () => {
    expect(getScoreLabel(88).label).toBe('Excellent');
    expect(getScoreLabel(100).label).toBe('Excellent');
  });

  test('75–87 → Strong', () => {
    expect(getScoreLabel(75).label).toBe('Strong');
    expect(getScoreLabel(87).label).toBe('Strong');
  });

  test('62–74 → Good', () => {
    expect(getScoreLabel(62).label).toBe('Good');
    expect(getScoreLabel(74).label).toBe('Good');
  });

  test('<62 → Needs work', () => {
    expect(getScoreLabel(61).label).toBe('Needs work');
    expect(getScoreLabel(30).label).toBe('Needs work');
  });

  test('returns a color string for each tier', () => {
    expect(getScoreLabel(90).color).toMatch(/^#/);
    expect(getScoreLabel(80).color).toMatch(/^#/);
    expect(getScoreLabel(65).color).toMatch(/^#/);
    expect(getScoreLabel(50).color).toMatch(/^#/);
  });
});

// ─── scoreAllTweets ───────────────────────────────────────────────────────────

describe('scoreAllTweets', () => {
  test('scores every tweet in the array', () => {
    const tweets = [
      { hookText: 'Most founders make this mistake.', fullText: 'Most founders make this mistake.\n\nThey skip the process.', ctaText: '' },
      { hookText: 'Stop ignoring your systems.', fullText: 'Stop ignoring your systems.\n\nThey compound faster than you think.', ctaText: '' },
    ];
    const result = scoreAllTweets(tweets, PROFILE);
    expect(result).toHaveLength(2);
    expect(typeof result[0].score).toBe('number');
    expect(typeof result[1].score).toBe('number');
  });

  test('preserves all original tweet fields', () => {
    const tweets = [{ id: 'tw_1', hookText: 'Hook.', fullText: 'Hook.\n\nBody.', ctaText: '', customField: 'keep me' }];
    const [result] = scoreAllTweets(tweets, PROFILE);
    expect(result.id).toBe('tw_1');
    expect(result.customField).toBe('keep me');
  });

  test('attaches scoreBreakdown with expected keys', () => {
    const tweets = [{ hookText: 'Hook.', fullText: 'Hook.\n\nBody.', ctaText: '' }];
    const [result] = scoreAllTweets(tweets, PROFILE);
    const keys = ['hookStrength', 'clarity', 'topicRelevance', 'engagementPotential', 'toneFit', 'ctaQuality', 'novelty', 'formatting'];
    for (const key of keys) {
      expect(result.scoreBreakdown).toHaveProperty(key);
    }
  });

  test('empty array returns empty array', () => {
    expect(scoreAllTweets([], PROFILE)).toEqual([]);
  });
});
