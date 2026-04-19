import { useState } from 'react';
import { X, Save, RefreshCw, Star, AlertTriangle, Wand2, Zap, Brain } from 'lucide-react';
import { scoreTweet, getScoreLabel } from '../lib/scoring.js';

// CTA suggestions keyed by tweet type
const CTA_SUGGESTIONS = {
  primary_educational: [
    { label: 'Open Loop', cta: "I'm sharing the exact workflow for this on Thursday. Follow so you don't miss it.", tip: 'Drives follows by teasing future content' },
    { label: 'Bookmark', cta: 'Bookmark this. You\'ll use it.', tip: 'High save rate for tactical frameworks' },
    { label: 'Resource DM', cta: 'Reply with STACK and I\'ll DM you the full setup guide.', tip: 'Builds DM list, qualifies hot leads' },
  ],
  secondary_educational: [
    { label: 'Which hits hardest', cta: 'Which one hits hardest? Let me know.', tip: 'Low friction — readers pick one item' },
    { label: 'Add to list', cta: 'What would you add? Drop it below.', tip: 'Invites contribution, expands reach' },
    { label: 'Save prompt', cta: 'Save this. Read it again on a slow day.', tip: 'Works well for mindset/performance content' },
  ],
  engagement: [
    { label: 'No CTA (let it stand)', cta: '', tip: 'Strong hot takes generate more organic QTs without a prompt — silence is a power move' },
    { label: 'Open Loop', cta: "I'm breaking down exactly why on Thursday. Follow so you don't miss it.", tip: 'Converts debate into followers' },
    { label: 'Debate invite', cta: 'Where do you disagree? Tell me.', tip: 'Invites pushback — high reply rate' },
  ],
};

// Auto-formatter for before_after template
function formatBeforeAfter(text) {
  const lines = text.split('\n').map(l => l.trim());
  const beforeIdx = lines.findIndex(l => /^before:/i.test(l));
  const afterIdx = lines.findIndex(l => /^after:/i.test(l));
  if (beforeIdx === -1 || afterIdx === -1) return null;

  const hookLines = lines.slice(0, beforeIdx).filter(Boolean);

  // Collect before items: inline comma list or subsequent lines until afterIdx
  const beforeInline = lines[beforeIdx].replace(/^before:\s*/i, '').trim();
  const beforeExtra = lines.slice(beforeIdx + 1, afterIdx).filter(Boolean);
  const beforeItems = beforeInline
    ? [beforeInline, ...beforeExtra]
    : beforeExtra;
  const beforeBullets = beforeItems.flatMap(s => s.split(/[,;]/).map(x => x.trim()).filter(Boolean));

  // Collect after items: inline comma list or subsequent lines until a blank / closing line
  const afterInline = lines[afterIdx].replace(/^after:\s*/i, '').trim();
  const afterExtra = lines.slice(afterIdx + 1).filter(Boolean);
  const afterItems = afterInline
    ? [afterInline, ...afterExtra]
    : afterExtra;
  const afterBullets = afterItems.flatMap(s => s.split(/[,;]/).map(x => x.trim()).filter(Boolean));

  // Last non-bullet item in afterItems is likely the closing/CTA
  const closing = afterBullets.length > 1 ? afterBullets.pop() : null;

  const parts = [
    ...hookLines,
    '',
    'The Old Way:',
    ...beforeBullets.map(item => `❌ ${item}`),
    '',
    'The New Way:',
    ...afterBullets.map(item => `✅ ${item}`),
  ];
  if (closing) parts.push('', closing);
  return parts.join('\n');
}

const TYPE_LABELS = {
  primary_educational: 'Primary Educational',
  secondary_educational: 'Secondary Educational',
  engagement: 'Engagement / Trend',
};

const JARGON_UPGRADE_PROMPT =
  'Replace any generic self-help or motivational phrases with specific operational frameworks and tactical terminology. ' +
  'Swap vague language ("know your why", "work smarter", "stay consistent") for precise mechanics ("90-minute deep work block", "async-first protocol", "output-based metrics"). ' +
  'Keep the same structure, hook, and CTA. Make it sound like a high-performance operator wrote it, not a life coach.';

export default function TweetEditor({ tweet, profile, onSave, onRegenerate, onClose }) {
  const isBeforeAfter = tweet.templateName?.toLowerCase().includes('before') ||
    tweet.tweetType === 'before_after';

  // Auto-format before/after tweets on open
  const [text, setFullText] = useState(() => {
    if (isBeforeAfter) {
      const formatted = formatBeforeAfter(tweet.fullText || '');
      return formatted || tweet.fullText || '';
    }
    return tweet.fullText || '';
  });

  const [regenInstructions, setRegenInstructions] = useState('');
  const [showRegen, setShowRegen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showCtas, setShowCtas] = useState(false);
  const [formatError, setFormatError] = useState(false);

  const ctaSuggestions = CTA_SUGGESTIONS[tweet.tweetType] || CTA_SUGGESTIONS.primary_educational;

  function openJargonUpgrader() {
    setRegenInstructions(JARGON_UPGRADE_PROMPT);
    setShowRegen(true);
  }

  function handleAutoFormat() {
    const formatted = formatBeforeAfter(text);
    if (formatted) {
      setFullText(formatted);
      setFormatError(false);
    } else {
      setFormatError(true);
      setTimeout(() => setFormatError(false), 3000);
    }
  }

  function applyCta(cta) {
    // Replace last line if it looks like an existing CTA, otherwise append
    const lines = text.trimEnd().split('\n');
    const lastLine = lines[lines.length - 1];
    const ctaPatterns = /^(bookmark|save|agree|disagree|repost|follow|reply|drop|what|which|tell|i'm breaking)/i;
    if (ctaPatterns.test(lastLine.trim())) {
      lines[lines.length - 1] = cta;
      setFullText(lines.join('\n'));
    } else {
      setFullText(cta ? `${text.trimEnd()}\n\n${cta}` : text.trimEnd());
    }
    setShowCtas(false);
  }

  const charCount = text.length;
  const overLimit = charCount > 280;

  const { score, breakdown } = scoreTweet({ ...tweet, fullText: text }, profile);
  const scoreInfo = getScoreLabel(score);

  async function handleRegen() {
    setRegenerating(true);
    try {
      await onRegenerate(tweet, regenInstructions);
    } finally {
      setRegenerating(false);
      setShowRegen(false);
    }
  }

  function handleSave() {
    if (overLimit) return;
    onSave({ ...tweet, fullText: text, score });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#13131f] border border-white/[0.08] rounded-2xl w-full max-w-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <div>
            <h2 className="text-white font-semibold">Edit Tweet</h2>
            <p className="text-slate-500 text-xs mt-0.5">
              Day {tweet.dayNumber} · {TYPE_LABELS[tweet.tweetType] || tweet.tweetType} · {tweet.templateName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white p-2 rounded-lg hover:bg-white/[0.04] transition-all"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Text editor */}
          <div>
            <textarea
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl p-4 text-white text-sm leading-relaxed placeholder-slate-600 focus:outline-none focus:border-violet-500/50 resize-none transition-all h-44"
              value={text}
              onChange={e => setFullText(e.target.value)}
              placeholder="Edit your tweet here..."
            />
            <div className="flex items-center justify-between mt-1.5">
              <span className={`text-xs ${overLimit ? 'text-red-400 font-semibold' : 'text-slate-500'}`}>
                {charCount}/280 characters
                {overLimit && ' — over limit!'}
              </span>
              {overLimit && (
                <span className="text-red-400 text-xs flex items-center gap-1">
                  <AlertTriangle size={11} />
                  Trim {charCount - 280} chars
                </span>
              )}
            </div>
          </div>

          {/* Toolbar: auto-format + CTA spinner + jargon upgrader */}
          <div className="flex items-center gap-2 flex-wrap">
            {isBeforeAfter && (
              <button
                type="button"
                onClick={handleAutoFormat}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                  formatError
                    ? 'border-red-500/50 text-red-400'
                    : 'border-white/[0.08] text-slate-400 hover:text-white hover:border-white/20'
                }`}
              >
                <Wand2 size={12} />
                {formatError ? 'No Before/After found' : 'Auto-format Before/After'}
              </button>
            )}
            {tweet.tweetType === 'secondary_educational' && (
              <button
                type="button"
                onClick={openJargonUpgrader}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-amber-500/30 text-amber-400 hover:text-amber-300 hover:border-amber-500/50 transition-all"
                title="Replace generic self-help phrases with tactical operational language"
              >
                <Brain size={12} />
                Upgrade language
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowCtas(v => !v)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-white/[0.08] text-slate-400 hover:text-white hover:border-white/20 transition-all"
            >
              <Zap size={12} />
              CTA suggestions
            </button>
          </div>

          {/* CTA Spinner panel */}
          {showCtas && (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 space-y-2">
              <p className="text-slate-500 text-xs mb-2">Click to apply — replaces existing CTA</p>
              {ctaSuggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => applyCta(s.cta)}
                  className="w-full text-left p-2.5 rounded-lg border border-white/[0.06] hover:border-violet-500/40 hover:bg-violet-500/5 transition-all group"
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium text-slate-300 group-hover:text-white">{s.label}</span>
                    {s.cta === '' && <span className="text-xs text-slate-600">removes CTA</span>}
                  </div>
                  {s.cta && <p className="text-xs text-slate-500 italic">"{s.cta}"</p>}
                  <p className="text-xs text-slate-600 mt-1">{s.tip}</p>
                </button>
              ))}
            </div>
          )}

          {/* Score */}
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Star size={14} style={{ color: scoreInfo.color }} />
                <span className="text-sm font-medium text-white">Quality Score</span>
              </div>
              <span className="font-bold text-lg" style={{ color: scoreInfo.color }}>
                {score}<span className="text-slate-500 text-sm font-normal">/100</span>
              </span>
            </div>

            {/* Score bar */}
            <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden mb-3">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${score}%`, backgroundColor: scoreInfo.color }}
              />
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(breakdown).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-slate-500 text-xs capitalize">{formatKey(key)}</span>
                  <span className="text-slate-300 text-xs font-medium">{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Regenerate section */}
          {showRegen ? (
            <div className="space-y-3">
              <textarea
                className="w-full bg-white/[0.04] border border-violet-500/30 rounded-xl p-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500/50 resize-none h-20"
                placeholder="Optional: what should change? (e.g. 'make it shorter', 'stronger hook', 'more specific')"
                value={regenInstructions}
                onChange={e => setRegenInstructions(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowRegen(false)}
                  className="flex-1 text-sm text-slate-400 border border-white/[0.08] rounded-xl py-2 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRegen}
                  disabled={regenerating}
                  className="flex-1 flex items-center justify-center gap-2 text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-xl py-2 transition-colors disabled:opacity-50"
                >
                  {regenerating ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  {regenerating ? 'Regenerating...' : 'Regenerate'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setShowRegen(true)}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-violet-400 border border-white/[0.08] hover:border-violet-500/40 rounded-xl px-4 py-2.5 transition-all"
              >
                <RefreshCw size={14} />
                AI Rewrite
              </button>
              <button
                onClick={handleSave}
                disabled={overLimit}
                className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl py-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save size={15} />
                Save Changes
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatKey(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}
