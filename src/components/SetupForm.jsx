import { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, AlertCircle, CalendarClock } from 'lucide-react';

const TONE_OPTIONS = ['practical', 'bold', 'educational', 'conversational', 'inspirational', 'analytical', 'humorous'];

const RISK_OPTIONS = [
  { value: 'safe',     label: 'Safe',     desc: 'Proven angles, low controversy' },
  { value: 'moderate', label: 'Moderate', desc: 'Some contrarian views, balanced' },
  { value: 'bold',     label: 'Bold',     desc: 'Hot takes, strong opinions' },
];

const GOAL_OPTIONS = [
  {
    value: 'audience_growth',
    label: 'Audience Growth',
    desc: 'Top of funnel · Reach new followers fast',
    icon: '🚀',
  },
  {
    value: 'authority_building',
    label: 'Authority Building',
    desc: 'Mid funnel · Become the go-to expert',
    icon: '🧠',
  },
  {
    value: 'lead_gen',
    label: 'Lead Gen / DMs',
    desc: 'Bottom of funnel · Drive inbound conversations',
    icon: '💬',
  },
  {
    value: 'community',
    label: 'Community Building',
    desc: 'Engagement · Build a loyal audience',
    icon: '🤝',
  },
];

const PRIMARY_CHIPS = [
  'AI & Automation', 'SaaS Growth', 'Bootstrapping', 'B2B Sales',
  'Content Marketing', 'No-Code / Low-Code', 'Startup Life', 'Product-Led Growth',
];
const SECONDARY_CHIPS = [
  'Founder Mindset', 'Productivity', 'Tech Stack', 'Leadership',
  'Personal Brand', 'Revenue & Finance', 'Work-Life Balance', 'Mental Health',
];

// Tone + risk clash overrides — surfaced into prompt via profile
export const TONE_RISK_OVERRIDES = {
  'inspirational+bold':    'tough love and contrarian motivation — challenge the reader with uncomfortable truths, not toxic positivity or preachiness',
  'humorous+bold':         'edgy, self-aware comedy — bold takes delivered with wit and timing, not arrogance',
  'educational+bold':      'direct and authoritative — state facts boldly, cut the qualifiers, respect the reader\'s intelligence',
  'conversational+bold':   'raw and unfiltered — like a mentor who tells you what you need to hear, not what feels good',
  'inspirational+safe':    'warm encouragement grounded in concrete examples — no vague platitudes, no empty motivation',
  'analytical+bold':       'data-driven contrarian — use evidence to challenge assumptions, let the numbers do the provoking',
};

export default function SetupForm({ onGenerate, onViewQueue, initialProfile }) {
  const [form, setForm] = useState({
    primaryTopic: '',
    secondaryTopic: '',
    tone: 'practical',
    goal: '',
    audience: '',
    ctaPreference: '',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
    avoidTopics: '',
    voiceNotes: '',
    riskLevel: 'moderate',
    techStack: '',
    ...initialProfile,
  });
  const [showOptional, setShowOptional] = useState(false);
  const [errors, setErrors] = useState({});

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
    if (errors[field]) setErrors(e => ({ ...e, [field]: null }));
  }

  function validate() {
    const e = {};
    if (!form.primaryTopic.trim()) e.primaryTopic = 'Required';
    if (!form.secondaryTopic.trim()) e.secondaryTopic = 'Required';
    if (!form.goal) e.goal = 'Select a goal';
    if (!form.audience.trim()) e.audience = 'Required — shapes your hooks and tone';
    return e;
  }

  function handleSubmit(ev) {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    // Inject clash override into voiceNotes so prompt picks it up
    const clashKey = `${form.tone}+${form.riskLevel}`;
    const override = TONE_RISK_OVERRIDES[clashKey];
    const enrichedForm = override
      ? { ...form, toneRiskOverride: override }
      : form;

    onGenerate(enrichedForm);
  }

  // Tone + risk clash warning for live UI feedback
  const clashKey = `${form.tone}+${form.riskLevel}`;
  const clashOverride = TONE_RISK_OVERRIDES[clashKey];

  return (
    <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-violet-600/20 border border-violet-500/30 rounded-full px-4 py-1.5 mb-4">
            <Sparkles size={14} className="text-violet-400" />
            <span className="text-violet-300 text-xs font-medium tracking-wide">TWEETFULL VIRAL WRITER</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Generate a week of tweets</h1>
          <p className="text-slate-400 text-sm">Fill in a few details — your AI content strategist does the rest.</p>
          {onViewQueue && (
            <button
              type="button"
              onClick={onViewQueue}
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              <CalendarClock size={13} />
              View scheduled queue
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-[#13131f] border border-white/[0.06] rounded-2xl p-6 space-y-5">

          {/* Primary Topic + chips */}
          <Field label="Primary topic" required error={errors.primaryTopic}>
            <input
              className={input(errors.primaryTopic)}
              placeholder="e.g. AI for SMB growth, SaaS marketing, personal finance"
              value={form.primaryTopic}
              onChange={e => set('primaryTopic', e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {PRIMARY_CHIPS.map(chip => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => set('primaryTopic', chip)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                    form.primaryTopic === chip
                      ? 'bg-violet-600/20 border-violet-500/50 text-violet-300'
                      : 'border-white/[0.08] text-slate-500 hover:text-slate-300 hover:border-white/20'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
          </Field>

          {/* Secondary Topic + chips */}
          <Field label="Secondary topic" required error={errors.secondaryTopic}>
            <input
              className={input(errors.secondaryTopic)}
              placeholder="e.g. founder mindset, productivity, leadership"
              value={form.secondaryTopic}
              onChange={e => set('secondaryTopic', e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {SECONDARY_CHIPS.map(chip => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => set('secondaryTopic', chip)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                    form.secondaryTopic === chip
                      ? 'bg-violet-600/20 border-violet-500/50 text-violet-300'
                      : 'border-white/[0.08] text-slate-500 hover:text-slate-300 hover:border-white/20'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
          </Field>

          {/* Target Audience — required, in main section */}
          <Field label="Target audience" required error={errors.audience} hint="Who are you writing for? This shapes your hooks and tone.">
            <input
              className={input(errors.audience)}
              placeholder="e.g. solo founders, agency owners, junior developers, SaaS executives"
              value={form.audience}
              onChange={e => set('audience', e.target.value)}
            />
          </Field>

          {/* Goal — selectable cards */}
          <Field label="Content goal" required error={errors.goal}>
            <div className="grid grid-cols-2 gap-2">
              {GOAL_OPTIONS.map(g => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => set('goal', g.value)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    form.goal === g.value
                      ? 'bg-violet-600/20 border-violet-500/60 text-white'
                      : 'bg-white/[0.03] border-white/[0.06] text-slate-400 hover:border-white/20'
                  }`}
                >
                  <div className="text-lg mb-1">{g.icon}</div>
                  <div className="font-medium text-sm">{g.label}</div>
                  <div className="text-xs mt-0.5 opacity-70 leading-snug">{g.desc}</div>
                </button>
              ))}
            </div>
          </Field>

          {/* Tone */}
          <Field label="Tone">
            <div className="flex flex-wrap gap-2">
              {TONE_OPTIONS.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('tone', t)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all capitalize ${
                    form.tone === t
                      ? 'bg-violet-600 border-violet-500 text-white'
                      : 'bg-white/[0.03] border-white/[0.08] text-slate-400 hover:text-white hover:border-white/20'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>

          {/* Risk Level */}
          <Field label="Content risk level">
            <div className="grid grid-cols-3 gap-2">
              {RISK_OPTIONS.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => set('riskLevel', r.value)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    form.riskLevel === r.value
                      ? 'bg-violet-600/20 border-violet-500/60 text-white'
                      : 'bg-white/[0.03] border-white/[0.06] text-slate-400 hover:border-white/20'
                  }`}
                >
                  <div className="font-medium text-sm">{r.label}</div>
                  <div className="text-xs mt-0.5 opacity-70">{r.desc}</div>
                </button>
              ))}
            </div>

            {/* Clash warning */}
            {clashOverride && (
              <div className="mt-2 flex items-start gap-2 bg-amber-950/30 border border-amber-500/30 rounded-lg px-3 py-2">
                <span className="text-amber-400 text-xs mt-0.5">⚡</span>
                <p className="text-amber-300 text-xs leading-snug">
                  <span className="font-semibold capitalize">{form.tone} + {form.riskLevel}</span> detected —
                  AI will write in <span className="italic">{clashOverride.split('—')[0].trim()}</span> mode.
                </p>
              </div>
            )}
          </Field>

          {/* Optional section */}
          <div>
            <button
              type="button"
              onClick={() => setShowOptional(v => !v)}
              className="flex items-center gap-2 text-slate-400 hover:text-slate-300 text-sm transition-colors"
            >
              {showOptional ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {showOptional ? 'Hide' : 'Show'} advanced settings
            </button>

            {showOptional && (
              <div className="mt-4 space-y-4 pt-4 border-t border-white/[0.06]">
                <Field label="CTA preference">
                  <input
                    className={input()}
                    placeholder="e.g. comments and follows, DMs, bookmarks"
                    value={form.ctaPreference}
                    onChange={e => set('ctaPreference', e.target.value)}
                  />
                </Field>

                <Field label="Topics to avoid">
                  <input
                    className={input()}
                    placeholder="e.g. politics, crypto, competitors"
                    value={form.avoidTopics}
                    onChange={e => set('avoidTopics', e.target.value)}
                  />
                </Field>

                <Field label="Your tech stack" hint="Tools you actually use — makes automation tweets credible and specific">
                  <input
                    className={input()}
                    placeholder="e.g. n8n, Supabase, Stripe, Claude, Typeform, Notion"
                    value={form.techStack}
                    onChange={e => set('techStack', e.target.value)}
                  />
                </Field>

                <Field label="Voice / brand notes">
                  <textarea
                    className={`${input()} resize-none h-20`}
                    placeholder="e.g. I say 'build' not 'scale', I prefer short sentences, no jargon..."
                    value={form.voiceNotes}
                    onChange={e => set('voiceNotes', e.target.value)}
                  />
                </Field>

                <Field label="Time zone">
                  <input
                    className={input()}
                    value={form.timeZone}
                    onChange={e => set('timeZone', e.target.value)}
                  />
                </Field>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors mt-2"
          >
            <Sparkles size={18} />
            Generate My Week
          </button>
        </form>

        <p className="text-center text-slate-600 text-xs mt-4">
          Generates 15 tweets • 5 days • 3 per day
        </p>
      </div>
    </div>
  );
}

function Field({ label, required, error, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">
        {label}
        {required && <span className="text-violet-400 ml-1">*</span>}
      </label>
      {hint && <p className="text-slate-500 text-xs mb-1.5">{hint}</p>}
      {children}
      {error && (
        <p className="flex items-center gap-1 text-red-400 text-xs mt-1">
          <AlertCircle size={12} />
          {error}
        </p>
      )}
    </div>
  );
}

function input(hasError) {
  return `w-full bg-white/[0.04] border ${hasError ? 'border-red-500/50' : 'border-white/[0.08]'} rounded-lg px-3 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-violet-500/60 focus:bg-white/[0.06] transition-all`;
}
