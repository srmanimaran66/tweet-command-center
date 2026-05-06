// Keyword-based hook signals
const STRONG_HOOK_WORDS = [
  'nobody', 'wrong', 'mistake', 'stop', 'truth', 'secret',
  'biggest', 'never', 'always', 'fastest', 'unpopular',
  'hot take', 'most people', 'they won\'t', 'what nobody',
  'underrated', 'overrated', 'actually', 'backwards',
  'lied', 'myth', 'lie', 'broken', 'failing', 'killing',
  'dying', 'dead', 'obsolete', 'outdated', 'replace', 'misleading', 'buried',
];

// Structural hook patterns — strong openers that don't rely on keywords
const STRONG_HOOK_PATTERNS = [
  /^\d[\d,]*\s+(ai|tool|step|hour|minute|day|week|month|\$)/i, // "14 hours saved", "3 AI moves"
  /\$[\d,]+[k]?\s+/i,                                           // "$6K in", "$30K month"
  /\d+[\d,]*\s*hour/i,                                          // "14 hours", "2 hours"
  /^(hustle|grind|busy|growth|scale|content|founder).{0,40}(lied|wrong|myth|broken|dead)/i,
  /won't .{5,40}\. (it'll|they'll|you'll)/i,                    // "won't X. It'll Y" contrarian flip
  /isn't .{5,40}\. it's/i,                                      // "isn't X. It's Y"
  /before.{5,30}after/i,                                        // before/after openers
  /^most \w+/i,                                               // 'Most founders/operators...' contrarian opens
  /I used to .{5,50}[.!] I should have/i,                       // reflection contrast hook
];

const ENGAGEMENT_SIGNALS = [
  '?', 'agree', 'disagree', 'comment', 'reply', 'repost',
  'bookmark', 'save', 'follow', 'drop', 'your take', 'below',
  'tell me', 'let me know', 'what\'s your', 'hit hardest',
  'reply with', 'open loop', 'thursday', 'tomorrow', 'next week',
];

const SPECIFICITY_SIGNALS = [
  /\d+%/, /\d+x/, /\$\d+/, /\d+ (day|week|month|year|hour|minute)/i,
  /after \d+/, /in \d+/, /\d+ (step|tip|lesson|way|reason)/i,
  /\d+[k]?\s*(revenue|month|arr|mrr)/i,
  /\d+[-–]\d+\s*(hour|hr|min)/i,
];

// Visual formatting markers that improve scannability
const FORMATTING_SIGNALS = [
  /[→•·]\s/,          // arrow/bullet lists
  /[✅❌⚡🔥☑]\s/u,     // emoji bullets
  /^\d\./m,           // numbered list
  /\*\*.+\*\*/,       // bold markdown
  /phase \d+/i,       // phase labels
  /before:|after:/i,  // contrast labels
];

// Open-loop CTAs that tease future content — higher value than generic CTAs
const OPEN_LOOP_PATTERNS = [
  /follow.{5,50}(thursday|tomorrow|next week|don't miss)/i,
  /i'm (breaking|sharing|posting|dropping).{5,50}(thursday|tomorrow|follow)/i,
  /stay tuned/i,
  /part \d+ (coming|drops|tomorrow)/i,
];

// Returns true if the second line of a tweet explains rather than increases tension
function hasWeakSecondLine(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return false;
  const second = lines[1].toLowerCase();
  const explanatory = /^(this |that |which |here's|here is|the reason|because |so |and |in other words|what this means|it means|meaning )/;
  const hasTension = STRONG_HOOK_WORDS.some(w => second.includes(w)) ||
    SPECIFICITY_SIGNALS.some(r => r.test(second)) ||
    /\d/.test(second);
  return explanatory.test(second) && !hasTension;
}

export function scoreTweet(tweet, profile) {
  const fullText = tweet.fullText || '';
  const hookText = (tweet.hookText || '').toLowerCase();
  const hookTextRaw = tweet.hookText || '';
  const ctaText = tweet.ctaText || '';

  let score = 0;
  const breakdown = {};

  // Hook strength (25 pts)
  // Both keyword signals AND structural patterns count
  const hasKeywordHook = STRONG_HOOK_WORDS.some(w => hookText.includes(w));
  const hasPatternHook = STRONG_HOOK_PATTERNS.some(r => r.test(hookTextRaw));
  const hookLen = hookText.length;
  const strongHook = hasKeywordHook || hasPatternHook;
  const hookScore = strongHook
    ? (hookLen >= 20 && hookLen <= 100 ? 25 : 20)
    : (hookLen >= 15 ? 15 : 10);
  score += hookScore;
  breakdown.hookStrength = hookScore;

  // Clarity / length (20 pts) — penalizes tweets over Twitter's 280-char limit
  const charCount = fullText.length;
  const clarityScore =
    charCount >= 80 && charCount <= 220 ? 20 :
    charCount > 220 && charCount <= 280 ? 17 :
    charCount > 280 ? 8 : 10;
  score += clarityScore;
  breakdown.clarity = clarityScore;

  // Topic relevance (15 pts)
  const topicWords = [
    ...(profile.primaryTopic || '').toLowerCase().split(/\s+/),
    ...(profile.secondaryTopic || '').toLowerCase().split(/\s+/),
  ].filter(w => w.length > 3);
  const relevantMatches = topicWords.filter(w =>
    fullText.toLowerCase().includes(w)
  ).length;
  const relevanceScore = Math.min(15, relevantMatches * 5 + 5);
  score += relevanceScore;
  breakdown.topicRelevance = relevanceScore;

  // Engagement potential (15 pts)
  const isOpinionTemplate = tweet.templateName === 'agree_disagree' || tweet.templateName === 'hot_take';
  const hasEngagement = ENGAGEMENT_SIGNALS.some(s => fullText.toLowerCase().includes(s));
  const hasQuestion = fullText.includes('?');
  const hasOpenLoop = OPEN_LOOP_PATTERNS.some(r => r.test(ctaText));
  const engagementScore = hasOpenLoop ? 15 :
    hasEngagement && hasQuestion ? 15 :
    hasEngagement ? 11 :
    isOpinionTemplate ? 11 : 7;
  score += engagementScore;
  breakdown.engagementPotential = engagementScore;

  // Tone fit (10 pts)
  const toneWords = (profile.tone || '').toLowerCase().split(/[\s,]+/);
  const toneMatch = toneWords.some(t => t.length > 3 && fullText.toLowerCase().includes(t));
  const toneScore = toneMatch ? 10 : 7;
  score += toneScore;
  breakdown.toneFit = toneScore;

  // CTA quality (10 pts) — open-loop CTAs score highest
  const hasOpenLoopCta = OPEN_LOOP_PATTERNS.some(r => r.test(ctaText));
  const noCtaIntentional = ctaText.trim().length === 0;
  const ctaScore = hasOpenLoopCta ? 10 :
    noCtaIntentional ? 8 :                              // deliberate no-CTA (hot take style)
    ctaText.length >= 10 && ctaText.length <= 80 ? 9 :
    ctaText.length > 0 ? 6 : 3;
  score += ctaScore;
  breakdown.ctaQuality = ctaScore;

  // Specificity (5 pts)
  const hasSpecificity = SPECIFICITY_SIGNALS.some(r => r.test(fullText));
  const noveltyScore = hasSpecificity ? 5 : 3;
  score += noveltyScore;
  breakdown.novelty = noveltyScore;

  // Structural formatting bonus (up to +5 pts, doesn't inflate base)
  const formattingCount = FORMATTING_SIGNALS.filter(r => r.test(fullText)).length;
  const formattingBonus = Math.min(5, formattingCount * 2);
  score += formattingBonus;
  breakdown.formatting = formattingBonus;

  const rawScore = Math.min(100, Math.max(30, score));
  return {
    score: hasWeakSecondLine(fullText) ? Math.min(82, rawScore) : rawScore,
    breakdown,
  };
}

export function getScoreLabel(score) {
  if (score >= 88) return { label: 'Excellent', color: '#10b981' };
  if (score >= 75) return { label: 'Strong', color: '#3b82f6' };
  if (score >= 62) return { label: 'Good', color: '#f59e0b' };
  return { label: 'Needs work', color: '#ef4444' };
}

export function scoreAllTweets(tweets, profile) {
  return tweets.map(tweet => {
    const { score, breakdown } = scoreTweet(tweet, profile);
    return { ...tweet, score, scoreBreakdown: breakdown };
  });
}
