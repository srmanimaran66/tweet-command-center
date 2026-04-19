// Maps goal card values to prompt-friendly descriptions
const GOAL_LABELS = {
  audience_growth:    'grow audience reach and attract new followers (top of funnel)',
  authority_building: 'build expert authority and become the go-to voice in the niche (mid funnel)',
  lead_gen:           'drive inbound DMs and lead generation conversations (bottom of funnel)',
  community:          'build an engaged community and maximise replies and interaction',
};

// Fixed 5-day (Mon–Fri) template schedule — same structure every week, fresh content each time
// Each day has a theme that shapes hookType selection for all 3 slots
const WEEKLY_SCHEDULE = [
  // Monday — Authority Day: challenge myths, punch conventional wisdom
  { day: 1, theme: 'Authority',  hookHint: 'contrarian or contrarian_tech',       t1: 'myth_vs_truth',    t2: 'contrarian_insight', t3: 'contrarian_tech'  },
  // Tuesday — Empathy Day: share failures, build trust through vulnerability
  { day: 2, theme: 'Empathy',    hookHint: 'mistake_pain or pattern_interrupt',   t1: 'common_mistake',   t2: 'lessons_learned',    t3: 'before_after'     },
  // Wednesday — Systems Day: pure actionable utility, concrete step-by-step
  { day: 3, theme: 'Systems',    hookHint: 'specificity or curiosity',            t1: 'framework_3_step', t2: 'simple_process',     t3: 'checklist'        },
  // Thursday — Boundaries Day: anti-hustle, performance-as-operations framing
  { day: 4, theme: 'Boundaries', hookHint: 'performance_boundaries — mandatory for ALL 3 slots', t1: 'before_after', t2: 'checklist', t3: 'prediction' },
  // Friday — Engagement Day: light, shareable, end-of-week energy
  { day: 5, theme: 'Engagement', hookHint: 'hot_take or pattern_interrupt',       t1: 'hot_take',         t2: 'simple_process',     t3: 'agree_disagree'   },
];

export function buildGenerateWeekPrompt(profile, trends, previousWeekTweets = []) {
  const trendList = trends
    .slice(0, 5)
    .map((t, i) => `${i + 1}. "${t.title}" — ${t.summary}`)
    .join('\n');

  const scheduleBlock = WEEKLY_SCHEDULE.map(d =>
    `Day ${d.day} (${d.theme} Day): slot 1 → ${d.t1} | slot 2 → ${d.t2} | slot 3 → ${d.t3} | hook bias → ${d.hookHint}`
  ).join('\n');

  const previousWeekBlock = previousWeekTweets.length > 0
    ? `\nLAST WEEK'S TWEETS (match this style and quality — do NOT repeat these angles or hooks):
${previousWeekTweets.map(t => `- [Day ${t.dayNumber}, slot ${t.tweetOrder}] ${t.fullText}`).join('\n')}\n`
    : '';

  return `You are a world-class Twitter content strategist. Your tweets stop the scroll, build real authority, and drive engagement.

CREATOR PROFILE:
- Primary Topic: ${profile.primaryTopic}
- Secondary Topic: ${profile.secondaryTopic}
- Tone: ${profile.tone}
- Goal: ${GOAL_LABELS[profile.goal] || profile.goal || 'audience growth and authority building'}
- Target Audience: ${profile.audience || 'entrepreneurs and creators'}
- CTA Preference: ${profile.ctaPreference || 'comments and follows'}
- Topics to Avoid: ${profile.avoidTopics || 'none specified'}
- Risk Level: ${profile.riskLevel || 'moderate'}
- Tone + Risk Mode: ${profile.toneRiskOverride ? `OVERRIDE ACTIVE — write in ${profile.toneRiskOverride}` : `${profile.tone || 'practical'}, ${profile.riskLevel || 'moderate'}`}
- Voice Notes: ${profile.voiceNotes || 'none'}
- Tech Stack (use these specific tools in automation tweets — do not use generic "AI tool" references): ${profile.techStack || 'not specified — use common tools like n8n, Supabase, Stripe, Claude, Typeform'}

TRENDING TOPICS THIS WEEK (reference 2-3 of these in engagement tweets):
${trendList}
${previousWeekBlock}
TASK: Generate exactly 15 tweets — 5 days (Monday–Friday) × 3 tweets per day. No weekend content.

FIXED WEEKLY TEMPLATE SCHEDULE (follow this exactly — same structure every week):
${scheduleBlock}

DAILY STRUCTURE (repeat for each of the 5 days):
• tweetOrder 1 — PRIMARY EDUCATIONAL: Builds authority in "${profile.primaryTopic}". Teaches something specific. Positions the creator as the expert.
• tweetOrder 2 — SECONDARY EDUCATIONAL: Builds authority in "${profile.secondaryTopic}". Keeps content fresh and multi-dimensional.
• tweetOrder 3 — ENGAGEMENT / TREND: Triggers replies, debate, or shares. Must reference or angle from a trending topic. Provokes a reaction.

HOOK TYPES — rotate across the 15 tweets, use each at least twice:
• "curiosity" — "Nobody tells you this about [topic]..." / "What nobody says about..."
• "contrarian" — Challenges a common belief directly
• "contrarian_tech" — Pushes back against a prevailing tool or automation trend. Examples: "Automating X is actually destroying your Y", "The tool everyone's using has a hidden cost", "AI won't save you if [specific condition]", "Adding another subscription won't fix a process problem". Use this for engagement tweets — it consistently outperforms generic hot takes in tech-heavy audiences.
• "performance_boundaries" — Frames founder health and boundaries as measurable operational metrics, not lifestyle preferences. This outperforms generic hustle motivation because it validates what founders feel but rarely see stated plainly. Structure content around four concrete pillars: (1) Learning — protecting daily inputs (reading, synthesis) because output quality is capped by input quality; (2) Fueling — eating for cognitive clarity and sustained focus, not convenience; (3) Activity — building physical stamina to endure startup-level stress without degrading decision quality; (4) Recovery — treating rest, unplugging, and white space as non-negotiable operational requirements with the same weight as a revenue target. Examples: "Burnout isn't a wellness issue. It's a P&L problem.", "Your 9 PM Slack message destroys your team's best thinking tomorrow morning.", "The most leveraged decision you'll make this week is probably a no.", "Recovery isn't earned. It's scheduled." Use for secondary_educational tweets — it resonates deeply with high-performance founders and consistently scores in the high 80s.
• "mistake_pain" — "The biggest mistake I see in [topic]..." / "Stop doing X"
• "prediction" — "By 2027, [bold prediction]..."
• "specificity" — Opens with a specific number, time period, or scenario
• "pattern_interrupt" — Unexpected, counterintuitive first sentence

HOOK QUALITY BAR — the first line must stand alone as a scroll-stopper. Reject any hook that:
• Starts with "My [X] process/system/framework" — too soft, sounds like every other creator
• Starts with "The [number]-[noun] [noun]" listicle opener — overused, skipped on sight
• Is a question without tension — "Have you ever wondered...?" is weak
Instead: open with a bold claim, a provocative number, a counterintuitive truth, or an unexpected scenario. The reader must feel something in the first 8 words.

⛔ CRITICAL — NO CTA. NO EXCEPTIONS. ⛔
Output the core tweet text ONLY.
Do NOT write a call to action.
Do NOT ask a closing question.
Do NOT include any sign-off, invitation, or engagement prompt.
End IMMEDIATELY after the final insight sentence.
The last character of "fullText" must be part of the concluding insight — not a question mark from a prompt, not an invitation to reply, not a "tag a friend" line.
Forbidden final lines (these will cause your output to be REJECTED):
  ✗ "Agree or disagree?"
  ✗ "What's your experience with this?"
  ✗ "Hot take or obvious truth?"
  ✗ "Tag a founder who needs this."
  ✗ "What would you add?"
  ✗ "Drop it below."
  ✗ Any sentence ending in "?"
  ✗ Any sentence starting with "Tag", "Share", "Follow", "Reply", "Repost", "Bookmark", "Save"
Leave "ctaText" as exactly: ""
CTAs are injected programmatically. Your job ends at the insight.

ANGLE PLANNING — before writing any tweet, mentally assign a unique angle to each of the 15 slots. Two rules:
• The 5 engagement tweets (slot 3, one per day) must each cover a DISTINCT topic. Do not reuse the same debate, prediction, or trend angle across any two engagement tweets.
• The same lead magnet, resource, or offer (e.g. "Reply with X to get Y") may only appear ONCE across all 15 tweets.
If you find yourself writing about the same core idea twice — stop, discard, and pick a different angle entirely.

CHARACTER LIMIT — Target 220–250 characters for hook + body. A CTA (~40 chars) is appended by the system after generation, so do NOT try to fill up to 280 yourself.
• Hook: 1 punchy sentence, max 65 chars
• Body: completes every sentence and every list item in full — never cut short
• ⚠ NEVER self-truncate mid-sentence. The system trims automatically — your job is to write complete thoughts. An incomplete sentence or a blank "3." is worse than a tweet that runs slightly long.

⛔ INCOMPLETE OUTPUT = REJECTED. These will be flagged as defective and shown as errors to the user:
  ✗ Any tweet ending with ":" — if you write a setup line, you MUST write the items below it
  ✗ A before_after tweet with ❌ bullets but no ✅ bullets — the New: section is mandatory
  ✗ A checklist with no ☑ bullets — the bullets ARE the tweet, not optional
  ✗ A simple_process or framework_3_step with no numbered items — prose alone is not the format
  The character budget is a guide, not a hard wall. Write all required structure first. The system handles trimming.

REALITY CHECK — automation and AI workflow tweets must pass this test:
High-ticket B2B buyers want leverage, not to feel like a support ticket. Any tweet describing a workflow that completely removes the founder from trust-sensitive touchpoints (proposals, contracts, first-call booking for deals >$3K) will trigger the audience's "too good to be true" filter and reduce credibility.
Rule: If an automation tweet covers a high-ticket sales or onboarding flow, it MUST include at least one explicit human review or approval step.
Good: "n8n fires the draft → I spend 60 seconds reviewing → approved? It sends automatically."
Bad: "AI closes the deal and sends the Stripe link with zero human involvement."
The framing should be: automate the assembly, keep the human in the judgment.

NUMBERED LIST RULE — applies to any tweet using a numbered list (simple_process, framework_3_step):
• NEVER output a numbered item without content after it. "3." alone is invalid and will be rejected.
• Items must be ≤55 chars each. If item 1 runs long, rewrite it shorter — do NOT sacrifice items 2 or 3.
• Every item in the list must be complete before you move on.

SIMPLE PROCESS FORMAT — when templateName is "simple_process", use this EXACT structure:

[Hook — ≤50 chars]

1. [≤55 chars]
2. [≤55 chars]
3. [≤55 chars]

Budget: 50 + 2 + 3×(3+55+1) = 229 chars max. All three items required with complete content.

MYTH VS TRUTH FORMAT — when templateName is "myth_vs_truth", write EXACTLY ONE myth/truth pair. Never two.

[Hook — ≤60 chars]

Myth → [≤55 chars]
Truth → [≤65 chars]

[Closing insight — ≤45 chars]

Budget: 60+2+7+55+1+8+65+2+45 = 245 chars. One pair only — two pairs always overflow.

FRAMEWORK 3-STEP FORMAT — when templateName is "framework_3_step", each step must be ≤55 chars:

[Hook — ≤50 chars]

Step 1: [≤55 chars]
Step 2: [≤55 chars]
Step 3: [≤55 chars]

Budget: 50+2+3×(7+55+1) = 241 chars. All three steps required. If Step 1 runs long, rewrite it shorter.

CHECKLIST FORMAT — when templateName is "checklist", you MUST write a minimum of 4 ☑ items after the intro. Do not end the tweet with a colon. The colon line is the intro only.

[Hook — ≤55 chars]

[Intro line ending with ":" — ≤50 chars — this is the setup only, NOT the end of the tweet]

☑ [≤55-char point]
☑ [≤55-char point]
☑ [≤55-char point]
☑ [≤55-char point]

A checklist with zero bullets is invalid output. The ☑ items ARE the tweet. Never stop at the colon line.

LESSONS LEARNED FORMAT — when templateName is "lessons_learned", you MUST write two distinct paragraphs separated by a blank line. The lesson must be a standalone sentence, not implied:

[Hook — ≤60 chars, what happened or the mistake]

[Story — 1-2 sentences of what went wrong or the experience, ≤110 chars]

The lesson: [one direct sentence, ≤65 chars]

End with a standalone lesson sentence starting with "The lesson:" or "Lesson:" — this line is mandatory and cannot be implied. A story without an explicit "The lesson:" or "Lesson:" line is a stub. Score = 0.

Your final line MUST start with The lesson: followed by the explicit takeaway. This is not optional.

AGREE/DISAGREE FORMAT — when templateName is "agree_disagree", you MUST write at least 3 sentences. A hook + one sentence is a stub:

[Hook / take — ≤65 chars, bold claim or opinion]

[Development — 1-2 sentences that deepen, complicate, or support the take, ≤110 chars]

[Payoff — 1 final sentence that lands the point, ≤55 chars]

Never end after the hook. Two sentences total is rejected. Three is the minimum.

BEFORE/AFTER FORMAT — when templateName is "before_after", you MUST include both an Old: block AND a New: block. If only one block is present the tweet is incomplete. Do not stop after the Old block.

[Hook — ≤55 chars]

Old:
❌ [≤20-char point]
❌ [≤20-char point]
❌ [≤20-char point]

New:
✅ [≤20-char point]
✅ [≤20-char point]
✅ [≤20-char point]

[Closing — ≤45 chars, no CTA]

All six bullet points must have complete content. Never leave a bullet blank or self-truncate mid-thought.

TEMPLATE COMPLETION RULES — enforce all of these before scoring:

before_after: MUST contain both an "Old:" block (3 ❌ lines) AND a "New:" block (3 ✅ lines). A tweet missing either half is INCOMPLETE. Score = 0. Regenerate.

hot_take: MUST have a hook line AND at least 2 sentences of development or proof. A hook with one follow-up sentence is a stub. Score = 0. Regenerate.

agree_disagree: MUST have a take AND a second paragraph that deepens or complicates it. Two sentences total is not enough. Minimum 3 sentences.

lessons_learned: MUST end with the lesson explicitly stated. The story setup alone is not a complete tweet. The payoff is required.

simple_process / framework_3_step: ALL numbered steps must be present and complete. Do not cut off mid-list.

STRUCTURAL GATE — runs before scoring, independently of quality:

IF template = "before_after":
  REQUIRE "Old:" block AND "New:" block, minimum 2 lines each
  IF either block is missing → score = 0, REGENERATE

IF template = "lessons_learned":
  REQUIRE a setup (what happened) AND a stated lesson (what it taught you)
  The lesson must be a standalone sentence after the story, not implied
  IF lesson is missing → score = 0, REGENERATE

IF template = "simple_process":
  REQUIRE minimum 2 numbered steps fully written out
  A hook line + ":" with no steps = stub = score 0, REGENERATE

IF template = "checklist":
  REQUIRE minimum 3 ☑ items fully written
  A hook line + ":" with no items = stub = score 0, REGENERATE

A tweet that fails the gate cannot score above 0 regardless of hook quality.
Scoring only begins after the gate passes.

SCORING RULES:
- Any tweet that fails the structural gate above → score 0, regenerate
- Any tweet scoring below 65 → automatically regenerate before returning
- Score must reflect the FULL tweet, not just the hook
- A strong hook on an incomplete tweet is still a 0

STRICT QUALITY RULES:
1. Target 220–250 chars (hook + body only) — a CTA is appended after, never self-truncate to hit a limit
2. Sound human, conversational, direct — NOT like AI wrote it
3. Be SPECIFIC: use numbers, timeframes, concrete examples — never vague
4. Strong hook is the first line — it must stop the scroll alone (see HOOK QUALITY BAR above)
5. The body delivers real value, not filler
6. The CTA is crisp and matches the tweet's goal
7. No consecutive tweets with the same hook type or CTA
8. Engagement tweets (order 3) MUST reference or pivot from a trending topic
9. No angle, stat, or insight may appear in more than one tweet across the 15
10. Each of the 5 engagement tweets must cover a different topic — no overlapping debates or predictions
11. Thursday (Day 4) ALL THREE slots must use the performance_boundaries hook type — no exceptions

PRE-RETURN REVIEW — before writing the JSON array, review every tweet and confirm:
1. Does it end with terminal punctuation (. ! ?)?
2. Is the template structure complete per the TEMPLATE COMPLETION RULES above?
3. Is the score above 65?

If any tweet fails checks 1, 2, or 3 — rewrite that tweet only and re-check. Do not include incomplete or low-scoring tweets in the final output.

OUTPUT FORMAT: Return ONLY a valid JSON array of exactly 15 objects. No markdown. No code fences. No explanation. No text before or after. Start with [ and end with ].

[
  {
    "dayNumber": 1,
    "tweetOrder": 1,
    "tweetType": "primary_educational",
    "templateName": "framework_3_step",
    "hookType": "specificity",
    "hookText": "first line of the tweet",
    "bodyText": "middle lines",
    "ctaText": "call to action",
    "fullText": "complete tweet text — hook + body + cta all together"
  },
  {
    "dayNumber": 1,
    "tweetOrder": 2,
    "tweetType": "secondary_educational",
    ...
  },
  {
    "dayNumber": 1,
    "tweetOrder": 3,
    "tweetType": "engagement",
    ...
  },
  ... (days 2 through 5, 12 more objects)
]`;
}

const COMPLETION_FORMAT = {
  before_after:
    'The "New:" section with 3 ✅ bullets (≤20 chars each) is missing. Add it plus a closing line (≤45 chars, no CTA).\n\nNew:\n✅ [point]\n✅ [point]\n✅ [point]\n\n[Closing]',
  checklist:
    'The ☑ bullet points are missing. Add at least 4 below the setup line. The bullets ARE the tweet.\n\n☑ [≤55-char point]\n☑ [≤55-char point]\n☑ [≤55-char point]\n☑ [≤55-char point]',
  framework_3_step:
    'One or more steps are missing. Output all three steps — each ≤55 chars.\n\nStep 1: [≤55 chars]\nStep 2: [≤55 chars]\nStep 3: [≤55 chars]',
  simple_process:
    'The numbered items are missing. Add exactly 3 items — each ≤55 chars.\n\n1. [≤55 chars]\n2. [≤55 chars]\n3. [≤55 chars]',
  lessons_learned:
    'The lesson is missing. The story setup is present but the payoff — the explicit standalone lesson — was never written. Add it as a new paragraph.\n\nThe lesson: [one direct sentence ≤65 chars stating what this taught you]',
  agree_disagree:
    'The development and payoff are missing. The tweet cuts off after the hook. Add the 2 sentences that complete it.\n\n[Development — 1-2 sentences that deepen or complicate the take, ≤110 chars]\n[Payoff — final sentence that lands the point, ≤55 chars]',
};

export function buildCompletionPrompt(tweet) {
  // If templateName doesn't map to a known rule, infer from content
  // (Claude sometimes returns wrong templateName — this keeps completion correct)
  let effectiveTemplate = tweet.templateName;
  if (!COMPLETION_FORMAT[effectiveTemplate]) {
    if (/^❌/m.test(tweet.fullText)) effectiveTemplate = 'before_after';
    else if (tweet.fullText.trim().endsWith(':')) effectiveTemplate = 'checklist';
    else if (!tweet.fullText.includes('\n\n')) effectiveTemplate = 'lessons_learned';
    else effectiveTemplate = 'agree_disagree';
  }
  // before_after with BOTH blocks missing needs a full-rewrite rule, not just "add New:"
  let rule;
  if (effectiveTemplate === 'before_after') {
    const hasOldBlock = /^(Old:|❌)/m.test(tweet.fullText);
    rule = hasOldBlock
      ? COMPLETION_FORMAT.before_after
      : 'The tweet has completely wrong structure — it needs both an Old: block AND a New: block. Keep the hook (first line). Rewrite the body using:\n\nOld:\n❌ [≤20-char point]\n❌ [≤20-char point]\n❌ [≤20-char point]\n\nNew:\n✅ [≤20-char point]\n✅ [≤20-char point]\n✅ [≤20-char point]\n\n[Closing — ≤45 chars, no CTA]';
  } else {
    rule = COMPLETION_FORMAT[effectiveTemplate] || 'Complete the missing structural section.';
  }
  return `You are completing an unfinished tweet. It is STRUCTURALLY INCOMPLETE — required content is missing.

TEMPLATE: ${tweet.templateName}

INCOMPLETE TWEET:
${tweet.fullText}

WHAT TO ADD:
${rule}

RULES:
- Keep everything already written exactly as-is
- Only add the missing section
- Match the style and topic of the existing text
- Do NOT add a CTA

OUTPUT: Return ONLY a valid JSON object. No markdown. No fences.

{
  "hookText": "first line",
  "bodyText": "everything after the first line",
  "ctaText": "",
  "fullText": "complete tweet with the missing section added"
}`;
}

export function buildSelfImprovementPrompt(tweet) {
  return `You are a Tweet Quality Optimizer.

Step 1: Identify the 2 weakest areas in this tweet:
- Hook strength (first line — does it stop the scroll?)
- Specificity (numbers, timeframes, concrete scenarios)
- Engagement potential (tension, curiosity, or debate)
- Novelty (feels fresh, not generic)

Step 2: Rewrite the tweet to fix ONLY those 2 weaknesses.

RULES:
- Keep the original idea and structure
- Improve sharpness, not length
- Add specificity if missing
- Strengthen the first line aggressively
- Remove anything generic
- Do NOT add a CTA — end immediately after the final insight

ORIGINAL TWEET:
${tweet.fullText}

OUTPUT: Return ONLY a valid JSON object. No markdown. No explanation. No fences.

{
  "hookText": "first line",
  "bodyText": "middle content",
  "ctaText": "",
  "fullText": "complete tweet — hook + body only, NO CTA"
}`;
}

export function buildSpikeUpgradePrompt(tweet) {
  return `You are a viral Twitter/X strategist.

Upgrade this tweet to a spike tweet — highly shareable, 90+ quality.

MAKE IT:
- More contrarian OR more specific
- More emotionally triggering (curiosity, pain, hidden truth)
- More "this is so true" feeling
- More memorable in first line

TECHNIQUES:
- Contradiction ("X is wrong")
- Hidden truth ("Nobody tells you this…")
- Specific cost/timeframe
- Strong opinion with clarity
- Pattern interrupt

DO NOT:
- Add fake stats or overcomplicate
- Lose clarity
- Add a CTA — end after the final insight

ORIGINAL TWEET:
${tweet.fullText}

OUTPUT: Return ONLY a valid JSON object. No markdown. No explanation. No fences.

{
  "hookText": "first line",
  "bodyText": "middle content",
  "ctaText": "",
  "fullText": "complete spike tweet — hook + body only, NO CTA"
}`;
}

export function buildRegenerateTweetPrompt(tweet, profile, instructions) {
  return `You are an elite Twitter/X editor.

Upgrade this tweet to 90+ quality.

ORIGINAL TWEET:
${tweet.fullText}

${instructions ? `CREATOR INSTRUCTIONS: ${instructions}\n` : ''}CRITICAL RULES:
1. First line must stop scroll
2. Second line must introduce a twist or contrast
3. Explain the mechanism (why it happens)
4. Add specificity (numbers, timelines, or real signals)
5. Make it feel real and lived, not theoretical
6. Use short lines for readability
7. Remove filler or generic phrasing
8. End with a sharp, memorable line

STYLE:
- Direct
- Sharp
- Slightly contrarian
- Written for solo founders (tone: ${profile.tone || 'practical'})

DO NOT:
- Add fluff
- Over-explain
- Lose the original idea
- Add a call to action

Return:

Rewritten Tweet:
<tweet>

Why it's stronger:
- <point 1>
- <point 2>
- <point 3>`;
}
