import { hasTweetDefect } from './ai.js';

const POOLS = {
  primary_educational: [
    "Bookmark this. You'll use it.",
    "Save this before your next build session.",
    "I'm sharing the exact workflow file on Thursday. Follow so you don't miss it.",
    "Reply with STACK and I'll DM you the full setup guide.",
    "Which step are you missing? Tell me.",
    "Share this with a founder still doing this manually.",
    "Try step 1 today. Tell me what changes.",
    "Save this. Then actually do step 1.",
    "Forward this to someone who needs the leverage.",
    "Which of these are you skipping? Drop it below.",
  ],
  secondary_educational: [
    "Which one hits hardest? Let me know.",
    "What would you add? Drop it below.",
    "Save this. Read it again on a hard day.",
    "Tag a founder who needs to hear this.",
    "Which do you struggle with most?",
    "Forward this to someone building something.",
    "Which line challenged you? Tell me.",
    "Save this. It compounds.",
    "Which one are you working on this week?",
    "Print this. Put it where you work.",
  ],
  engagement: [
    "",
    "Where do you disagree? Tell me.",
    "Agree or disagree?",
    "What's your experience with this?",
    "What am I missing? Drop it below.",
    "Breaking this down further on Thursday. Follow so you don't miss it.",
    "Reply with YES if you've seen this firsthand.",
    "Hot take or obvious truth? You tell me.",
    "Prove me wrong.",
    "Which side are you on?",
  ],
};

function makeTracking() {
  return {
    usedTexts: new Set(),
    usedIndices: {
      primary_educational: new Set(),
      secondary_educational: new Set(),
      engagement: new Set(),
    },
  };
}

// Module-level state kept only for backward-compat with direct pickCta() calls in tests.
let _moduleTracking = makeTracking();

export function resetCtaTracking() {
  _moduleTracking = makeTracking();
}

function pickCtaWithTracking(tweetType, tracking) {
  const { usedTexts, usedIndices } = tracking;
  const pool = POOLS[tweetType] || POOLS.primary_educational;
  const used = usedIndices[tweetType] || new Set();

  let available = pool
    .map((text, i) => ({ text, i }))
    .filter(({ text, i }) => !used.has(i) && !usedTexts.has(text));

  if (available.length === 0) {
    used.clear();
    available = pool
      .map((text, i) => ({ text, i }))
      .filter(({ text }) => !usedTexts.has(text));
  }

  if (available.length === 0) {
    usedTexts.clear();
    available = pool.map((text, i) => ({ text, i }));
  }

  const pick = available[Math.floor(Math.random() * available.length)];
  used.add(pick.i);
  if (pick.text) usedTexts.add(pick.text);
  return pick.text;
}

export function pickCta(tweetType) {
  return pickCtaWithTracking(tweetType, _moduleTracking);
}

// Patterns that indicate the LLM hallucinated a CTA (tested against the raw line text)
const CTA_PATTERNS = [
  /^(agree|disagree|hot take|what's your|what would|drop it|tag a|share this|follow|reply with|repost|bookmark|save this|which one|which side|which camp|prove me|what am i).*/i,
  // Only strip question lines that start with a known CTA opener — bare \?$ is too broad
  // and strips legitimate rhetorical content questions at the end of tweet bodies.
  /^(agree|disagree|hot take|what's your|what would|which side|which one|which camp|prove me wrong|where do you stand|your take|got a take).+\?$/i,
  /^(i'm breaking|i'm sharing|breaking this down|sharing this).*(thursday|tomorrow|follow)/i,
  /^(print this|forward this|try step|which step|which do you|which line|which one are you|which of these).*/i,
];

// Returns just the content portion of a line, stripping a leading list marker if present.
// "3. Reply with STACK" → "Reply with STACK"
// "Reply with STACK"    → "Reply with STACK"
function stripListMarker(line) {
  return line.replace(/^\d+\.\s*/, '').replace(/^[-•]\s*/, '');
}

// Strip trailing CTA lines (and CTA content inside list items) the LLM hallucinated
function stripTrailingCta(text) {
  const lines = text.trimEnd().split('\n');

  // Walk backwards and remove lines that look like CTAs
  while (lines.length > 1) {
    const last = lines[lines.length - 1].trim();
    if (!last) {
      lines.pop(); // remove blank line at end
      continue;
    }
    // Test both the raw line and the content after any list marker
    const content = stripListMarker(last);
    if (CTA_PATTERNS.some(r => r.test(last) || r.test(content))) {
      lines.pop();
    } else {
      break;
    }
  }

  return lines.join('\n').trimEnd();
}

// Remove blank list item markers left by the LLM ("3." alone on a line) and
// collapse any resulting triple-newlines left behind.
function cleanListItems(text) {
  return text
    .split('\n')
    .filter(line => !/^(\d+\.|-|•|☑)\s*$/.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function applyCtasToTweets(tweets) {
  const tracking = makeTracking();
  return tweets.map(tweet => {
    // Strip AI-hallucinated CTAs, remove blank list markers
    const stripped = stripTrailingCta(tweet.fullText || '');
    const cleanBody = cleanListItems(stripped);

    // Single source of truth for defect detection — re-evaluated on the cleaned body
    // so stripping a CTA can't leave a structurally broken tweet marked non-defective
    const defective = hasTweetDefect(cleanBody, tweet.templateName);

    if (defective) {
      return { ...tweet, ctaText: '', fullText: cleanBody, defective: true };
    }

    // Store CTA as card metadata only — fullText stays clean and postable as-is
    const cta = pickCtaWithTracking(tweet.tweetType, tracking);
    return { ...tweet, ctaText: cta, fullText: cleanBody, defective: false };
  });
}
