const API_URL = '/api/messages';
const APP_TOKEN = import.meta.env.VITE_API_TOKEN || '';

export async function callClaude(userPrompt, { maxTokens = 8000 } = {}) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-app-token': APP_TOKEN,
    },
    body: JSON.stringify({
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API request failed (${response.status}): ${err}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || JSON.stringify(data.error));
  }

  const text = data.content?.[0]?.text;
  if (!text) throw new Error('Empty response from Claude');
  return text;
}

/**
 * Strip generation artifacts (<tweet> placeholder, stray leading <) from raw tweet text.
 */
export function cleanTweetArtifacts(text) {
  if (!text) return text;
  // Remove <tweet> placeholder tag at the start
  let cleaned = text.replace(/^<tweet>\n?/i, '');
  // Remove a stray < at the very start (e.g. "<Solo founder..." artifact)
  cleaned = cleaned.replace(/^<(?=[A-Z])/, '');
  return cleaned.trim();
}

/**
 * Detect whether a tweet has a structural defect (empty list marker, abrupt cut-off,
 * missing section, or wrong format for the template).
 * Returns true if the tweet needs regeneration.
 */
export function hasTweetDefect(text, templateName = '') {
  if (!text) return true;
  const lines = text.split('\n');
  const nonEmpty = lines.filter(l => l.trim());
  const lastNonEmpty = nonEmpty[nonEmpty.length - 1]?.trim() ?? '';

  // Empty numbered or bulleted list item alone on a line
  if (lines.some(l => /^(\d+\.|-|•|☑)\s*$/.test(l.trim()))) return true;

  // Last non-empty line is just a list marker
  if (/^(\d+\.|-|•|☑)\s*$/.test(lastNonEmpty)) return true;

  // Setup line ending with ":" — the body/list was never written
  if (lastNonEmpty.endsWith(':')) return true;

  // Truncated mid-sentence: text ends with a bare number (e.g. "stalled decisions for 3")
  if (/\s\d+$/.test(text.trimEnd())) return true;

  // Truncated mid-sentence: last non-whitespace character is not terminal punctuation.
  // Skip list formats where the final item legitimately ends without punctuation.
  const LIST_FORMATS = ['simple_process', 'framework_3_step', 'checklist'];
  if (!LIST_FORMATS.includes(templateName) && !/[.!?]$/.test(text.trimEnd())) return true;

  // before_after: must have both an Old block and a New/After block
  // Fires on templateName match OR on ❌ emoji presence (content-based, survives wrong templateName)
  // Uses line-start anchors — prevents "After:" inside body text from faking hasNew = true
  if (templateName === 'before_after' || lines.some(l => /^❌/.test(l.trim()))) {
    const hasOldLine = lines.some(l => /^(Old:|❌)/.test(l.trim()));
    const hasNewLine = lines.some(l => /^(New:|After:|✅)/.test(l.trim()));
    if (!hasOldLine || !hasNewLine) return true;
  }

  // hot_take / contrarian_tech / agree_disagree: must have at least 3 sentences
  if (templateName === 'hot_take' || templateName === 'contrarian_tech' || templateName === 'agree_disagree') {
    const sentenceCount = (text.match(/[.!?](?=[\s\n]|$)/g) || []).length;
    if (sentenceCount < 3) return true;
  }

  // prediction: hook alone is a stub — requires at least 3 sentences
  if (templateName === 'prediction') {
    const sentenceCount = (text.match(/[.!?](?=[\s\n]|$)/g) || []).length;
    if (sentenceCount < 3) return true;
  }

  // Dangling rhetorical tease: last SENTENCE ends with "The real X isn...t [interrogative]"
  // — a setup that implies a payoff the tweet never delivers
  const lastSentence = text.trimEnd().split(/(?<=[.!?])\s+/).pop()?.trim() ?? "";
  if (/\bThe real \w+ isn/i.test(lastSentence) && /\b(what|who|why|where|when|how|whether)\b/i.test(lastSentence)) return true;

  // simple_process: items 1, 2, and 3 must each be explicitly present
  if (templateName === 'simple_process') {
    if (!/^1\./m.test(text) || !/^2\./m.test(text) || !/^3\./m.test(text)) return true;
  }

  // framework_3_step: Step 1, Step 2, and Step 3 must each be explicitly present
  // (count alone doesn't catch duplicate steps or missing middle steps)
  if (templateName === 'framework_3_step') {
    const has1 = /^(1\.|Step 1:)/im.test(text);
    const has2 = /^(2\.|Step 2:)/im.test(text);
    const has3 = /^(3\.|Step 3:)/im.test(text);
    if (!has1 || !has2 || !has3) return true;
  }

  // checklist: must contain at least 4 ☑ bullets (prompt requires minimum 4)
  if (templateName === 'checklist' && (text.match(/^☑/gm) || []).length < 4) return true;

  // lessons_learned: payoff paragraph must be present and read as a lesson, not more story.
  // A multi-sentence payoff without "lesson" keyword signals the story is still running —
  // e.g. "By Thursday I was making decisions I'd regret by Monday." is not a lesson.
  // Single-sentence conclusions pass without the keyword (they read as principles).
  if (templateName === 'lessons_learned') {
    const parts = text.split('\n\n');
    if (parts.length < 2) return true;
    const lessonPart = parts[parts.length - 1].trim();
    if (!lessonPart || !/[.!?]/.test(lessonPart)) return true;
    const hasLessonKeyword = /\blesson\b/i.test(lessonPart);
    const lessonSentences = (lessonPart.match(/[.!?]/g) || []).length;
    if (!hasLessonKeyword && lessonSentences > 1) return true;
  }

  // simple_process / checklist stub: hook line ends with ":" but items never follow
  // (catches mid-tweet colons, not just when ":" is the very last character)
  if (['simple_process', 'checklist'].includes(templateName)) {
    const hasColon = nonEmpty.some(l => l.trim().endsWith(':'));
    const hasItems = templateName === 'checklist'
      ? text.includes('☑')
      : /^\d+\./m.test(text);
    if (hasColon && !hasItems) return true;
  }

  return false;
}

/**
 * Trim tweet text to `limit` chars at the cleanest structural boundary available.
 * Priority: paragraph break → line break → sentence end → word boundary.
 * This ensures we never cut mid-sentence when a clean block boundary exists nearby.
 */
export function enforceCharLimit(text, limit = 280) {
  if (!text || text.length <= limit) return text;

  const truncated = text.slice(0, limit);
  const floor = limit * 0.35; // don't cut in the first 35% of the budget

  // 1. Paragraph break (\n\n) — cleanest boundary between tweet blocks
  const lastPara = truncated.lastIndexOf('\n\n');
  if (lastPara > floor) {
    return text.slice(0, lastPara).trimEnd();
  }

  // 2. Single line break — next cleanest
  const lastLine = truncated.lastIndexOf('\n');
  if (lastLine > floor) {
    return text.slice(0, lastLine).trimEnd();
  }

  // 3. Sentence-ending punctuation followed by space or newline
  const sentenceEnd = Math.max(
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('.\n'),
    truncated.lastIndexOf('! '),
    truncated.lastIndexOf('!\n'),
  );
  if (sentenceEnd > floor) {
    return text.slice(0, sentenceEnd + 1).trimEnd();
  }

  // 4. Word boundary — last resort
  const lastSpace = truncated.lastIndexOf(' ');
  return text.slice(0, lastSpace > 0 ? lastSpace : limit).trimEnd();
}

export function parseJSON(text) {
  // Strip any markdown fences if Claude wraps it anyway
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    // Search from the right: Claude puts JSON last, so lastIndexOf is more reliable
    // than a greedy /\[[\s\S]*\]/ which spans from the first [ to the last ]
    // and breaks when prose before the JSON contains [brackets].
    const arrStart = cleaned.lastIndexOf('[');
    if (arrStart !== -1) {
      try { return JSON.parse(cleaned.slice(arrStart)); } catch {}
    }
    const objStart = cleaned.lastIndexOf('{');
    if (objStart !== -1) {
      try { return JSON.parse(cleaned.slice(objStart)); } catch {}
    }
    throw new Error('Could not parse JSON from response');
  }
}
