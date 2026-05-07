import { useState, useCallback } from 'react';
import SetupForm from './components/SetupForm.jsx';
import WeeklyPlanner from './components/WeeklyPlanner.jsx';
import TweetEditor from './components/TweetEditor.jsx';
import ScheduleReview from './components/ScheduleReview.jsx';
import { callClaude, parseJSON, enforceCharLimit, enforceListItemLimit, hasTweetDefect, cleanTweetArtifacts } from './lib/ai.js';
import { buildGenerateWeekPrompt, buildRegenerateTweetPrompt, buildCompletionPrompt, buildPlainTextCompletionPrompt, buildSelfImprovementPrompt, buildSpikeUpgradePrompt } from './lib/prompts.js';
import { scoreAllTweets, scoreTweet } from './lib/scoring.js';
import { applyCtasToTweets } from './lib/ctas.js';
import { assignSchedule, getNextMonday } from './lib/scheduler.js';
import { getTrendsForProfile } from './lib/trends.js';
import { AlertCircle, RefreshCw } from 'lucide-react';

const STORAGE_KEY = 'tweetfull_profile';
const PREV_WEEK_KEY = 'tweetfull_previous_week';
const HOOK_HISTORY_KEY = 'tweetfull_hook_history';
const PROFILE_VERSION = 1;
const PREV_WEEK_VERSION = 1;
const HOOK_HISTORY_VERSION = 2;
const PREV_WEEK_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const HOOK_HISTORY_TTL_MS = 21 * 24 * 60 * 60 * 1000; // 21 days — 3-week rolling window
const HOOK_HISTORY_MAX_WEEKS = 3;

function loadProfile() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!data || data._version !== PROFILE_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

function saveProfile(profile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...profile, _version: PROFILE_VERSION }));
}

function loadPreviousWeek() {
  try {
    const data = JSON.parse(localStorage.getItem(PREV_WEEK_KEY) || 'null');
    if (!data || data._version !== PREV_WEEK_VERSION) return [];
    if (Date.now() - data._savedAt > PREV_WEEK_TTL_MS) return [];
    return data.tweets || [];
  } catch {
    return [];
  }
}

function savePreviousWeek(tweets) {
  const slim = tweets.map(t => ({
    dayNumber: t.dayNumber,
    tweetOrder: t.tweetOrder,
    fullText: t.fullText,
  }));
  localStorage.setItem(PREV_WEEK_KEY, JSON.stringify({
    _version: PREV_WEEK_VERSION,
    _savedAt: Date.now(),
    tweets: slim,
  }));
}

function loadHookHistory() {
  try {
    const data = JSON.parse(localStorage.getItem(HOOK_HISTORY_KEY) || "null");
    if (!data || data._version !== HOOK_HISTORY_VERSION) return [];
    const now = Date.now();
    return (data.weeks || [])
      .filter(w => now - w._savedAt < HOOK_HISTORY_TTL_MS)
      .slice(0, HOOK_HISTORY_MAX_WEEKS);
  } catch {
    return [];
  }
}

function saveHookHistory(tweets) {
  try {
    const hooks = tweets
      .filter(t => t.fullText)
      .map(t => ({
        dayNumber: t.dayNumber,
        tweetOrder: t.tweetOrder,
        angle: (t.fullText || '').slice(0, 200).replace(/\n+/g, ' ').trim(),
      }));
    const existing = loadHookHistory();
    const weeks = [{ _savedAt: Date.now(), hooks }, ...existing].slice(0, HOOK_HISTORY_MAX_WEEKS);
    localStorage.setItem(HOOK_HISTORY_KEY, JSON.stringify({ _version: HOOK_HISTORY_VERSION, weeks }));
  } catch {
    // storage errors are non-fatal
  }
}

let nextId = 1;
function genId() { return `tw_${nextId++}_${Date.now()}`; }

// Error screen
function ErrorScreen({ error, onRetry, onBack }) {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return (
    <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
          <AlertCircle size={24} className="text-red-400" />
        </div>
        <h2 className="text-white font-semibold text-lg mb-2">Generation failed</h2>
        <p className="text-slate-400 text-sm mb-2">{error}</p>
        {isLocal && (
          <p className="text-slate-600 text-xs mb-6">
            Make sure the server is running: <code className="text-slate-400">node server.js</code>
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={onBack}
            className="text-slate-400 hover:text-white border border-white/[0.08] rounded-xl px-4 py-2 text-sm transition-colors"
          >
            Edit profile
          </button>
          <button
            onClick={onRetry}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl px-4 py-2 text-sm font-medium transition-colors"
          >
            <RefreshCw size={14} />
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

// Build 15 skeleton placeholder tweets shown instantly while generating
function createSkeletons() {
  const typeMap = ['primary_educational', 'secondary_educational', 'engagement'];
  const skeletons = [];
  for (let day = 1; day <= 5; day++) {
    for (let slot = 1; slot <= 3; slot++) {
      skeletons.push({
        id: `skeleton_${day}_${slot}`,
        dayNumber: day,
        tweetOrder: slot,
        tweetType: typeMap[slot - 1],
        skeleton: true,
        status: 'draft',
        score: 0,
        displayTime: ['12:15 PM', '3:10 PM', '5:40 PM'][slot - 1],
      });
    }
  }
  return skeletons;
}

export default function App() {
  const [view, setView] = useState('setup');          // setup | planner | schedule | error
  const [profile, setProfile] = useState(loadProfile);
  const [tweets, setTweets] = useState([]);
  const [editingTweet, setEditingTweet] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [lastProfile, setLastProfile] = useState(null);
  const [regenError, setRegenError] = useState(null);

  // ─── Generation pipeline ──────────────────────────────────────────────
  const generateWeek = useCallback(async (p) => {
    setProfile(p);
    setLastProfile(p);
    saveProfile(p);
    setError(null);

    // Immediately show the skeleton board — no spinner screen
    setTweets(createSkeletons());
    setIsGenerating(true);
    setView('planner');

    try {
      const trends = getTrendsForProfile(p);
      const previousWeekTweets = loadPreviousWeek();
      const hookHistory = loadHookHistory();
      const prompt = buildGenerateWeekPrompt(p, trends, previousWeekTweets, hookHistory);
      const raw = await callClaude(prompt, { maxTokens: 12000 });
      const parsed = parseJSON(raw);

      if (!Array.isArray(parsed) || parsed.length < 15) {
        throw new Error(`Expected 15 tweets, got ${Array.isArray(parsed) ? parsed.length : 0}. Please try again.`);
      }

      const withIds = parsed.slice(0, 15).map(t => {
        const fullText = enforceCharLimit(cleanTweetArtifacts(t.fullText));
        return {
          ...t,
          id: genId(),
          status: 'draft',
          score: t.score || 70,
          fullText,
          defective: hasTweetDefect(fullText, t.templateName),
        };
      });
      const withCtas = applyCtasToTweets(withIds);
      const scored = scoreAllTweets(withCtas, p);

      // Auto-improve: <65 → self-improvement, >85 → spike upgrade
      const improved = await Promise.all(scored.map(async (tweet) => {
        let improvePrompt;
        if (tweet.defective) {
          improvePrompt = buildCompletionPrompt(tweet);
        } else if (tweet.score < 65) {
          console.log(`[improve] Day ${tweet.dayNumber} slot ${tweet.tweetOrder} score=${tweet.score} → self-improve`);
          improvePrompt = buildSelfImprovementPrompt(tweet);
        } else if (tweet.score > 85) {
          improvePrompt = buildSpikeUpgradePrompt(tweet);
        } else {
          improvePrompt = null;
        }
        if (!improvePrompt) return tweet;
        try {
          const improveRaw = await callClaude(improvePrompt, { maxTokens: 1000 });
          const updated = parseJSON(improveRaw);
          if (!updated.fullText) return tweet;
          // Completion results must NOT go through enforceCharLimit — the structural
          // items are separated from the hook by \n\n, and enforceCharLimit's paragraph-break
          // preference cuts there, discarding the just-added content.
          // Quality improvements and spike upgrades are fine to trim normally.
          const rawText = cleanTweetArtifacts(updated.fullText);
          const fullText = tweet.defective ? rawText : enforceCharLimit(rawText);
          return { ...tweet, hookText: updated.hookText || tweet.hookText, bodyText: updated.bodyText || tweet.bodyText, fullText, defective: hasTweetDefect(fullText, tweet.templateName), improveFailed: false };
        } catch (err) {
          console.warn(`[improve pass 1] Day ${tweet.dayNumber} slot ${tweet.tweetOrder} failed:`, err.message);
          return { ...tweet, improveFailed: true };
        }
      }));

      const rescored = scoreAllTweets(improved, p);

      // Second pass: completion first (if still defective), then self-improvement (if still < 65)
      // Running both sequentially in one pass ensures defective+low-score tweets get quality lifted
      const secondImproved = await Promise.all(rescored.map(async (tweet) => {
        let current = tweet;

        if (current.defective) {
          let lastP2Error = 'no attempt';
          for (let attempt = 1; attempt <= 3 && current.defective; attempt++) {
            try {
              const raw = await callClaude(buildCompletionPrompt(current), { maxTokens: 2000 });
              const updated = parseJSON(raw);
              if (updated?.fullText) {
                const fullText = cleanTweetArtifacts(updated.fullText);
                const defective = hasTweetDefect(fullText, current.templateName);
                if (!defective) {
                  const { score } = scoreTweet({ ...current, fullText }, p);
                  current = { ...current, fullText, hookText: updated.hookText || current.hookText, bodyText: updated.bodyText || current.bodyText, score, defective: false, improveFailed: false };
                } else {
                  lastP2Error = `still-defective after JSON completion (template=${current.templateName}, text="${fullText.slice(0, 80)}")`;
                }
              } else {
                lastP2Error = `parseJSON returned no fullText (raw="${(raw||'').slice(0, 120)}")`;
              }
            } catch (err) {
              lastP2Error = err.message;
              console.warn(`[pass2 attempt ${attempt}] D${current.dayNumber}S${current.tweetOrder}:`, err.message);
            }
          }
          if (current.defective) current = { ...current, improveFailed: true, _p2Error: lastP2Error };
        }

        if (!current.defective && current.score < 65) {
          try {
            const raw = await callClaude(buildSelfImprovementPrompt(current), { maxTokens: 1000 });
            const updated = parseJSON(raw);
            if (updated.fullText) {
              const fullText = enforceCharLimit(cleanTweetArtifacts(updated.fullText));
              current = { ...current, fullText, hookText: updated.hookText || current.hookText, bodyText: updated.bodyText || current.bodyText, defective: hasTweetDefect(fullText, current.templateName), improveFailed: false };
            }
          } catch (err) {
            console.warn(`[improve pass 2 quality] Day ${current.dayNumber} slot ${current.tweetOrder} failed:`, err.message);
            current = { ...current, improveFailed: true };
          }
        }

        return current;
      }));
      const rescored2 = scoreAllTweets(secondImproved, p);

      // Pass 3: plain-text fallback for tweets that survived all JSON-based completion attempts.
      // Avoids JSON entirely — Claude outputs raw tweet text, no parsing can fail.
      const thirdImproved = await Promise.all(rescored2.map(async (tweet) => {
        if (!tweet.defective) return tweet;
        let p3Error = 'not attempted';
        try {
          const raw = await callClaude(buildPlainTextCompletionPrompt(tweet), { maxTokens: 1000 });
          const fullText = cleanTweetArtifacts(raw.trim());
          console.log(`[pass3] D${tweet.dayNumber}S${tweet.tweetOrder} raw (first 200):`, JSON.stringify(fullText.slice(0, 200)));
          if (fullText && !hasTweetDefect(fullText, tweet.templateName)) {
            const { score } = scoreTweet({ ...tweet, fullText }, p);
            return { ...tweet, fullText, score, defective: false, improveFailed: false };
          }
          p3Error = `still-defective: "${fullText.slice(0, 120)}"`;
        } catch (err) {
          p3Error = err.message;
          console.warn(`[pass3] D${tweet.dayNumber}S${tweet.tweetOrder}:`, err.message);
        }
        return { ...tweet, _p3Error: p3Error };
      }));
      const rescored3 = scoreAllTweets(thirdImproved, p);

      // Final length pass: enforce 280-char limit per template strategy.
      // before_after: enforceCharLimit cuts cleanly after the first New: block.
      // checklist / framework_3_step: enforceListItemLimit drops trailing items or
      //   shortens the last item's text — never cuts at \n\n which would discard bullets.
      // simple_process: skipped — completion pass already enforces 3-item structure.
      const SKIP_TRIM = new Set(['simple_process']);
      const LIST_TRIM = new Set(['checklist', 'framework_3_step']);
      const normalized = rescored3.map(tweet => {
        if (!tweet.fullText || tweet.fullText.length <= 280 || SKIP_TRIM.has(tweet.templateName || '')) return tweet;
        const tmpl = tweet.templateName || '';
        const fullText = LIST_TRIM.has(tmpl)
          ? enforceListItemLimit(tweet.fullText, tmpl)
          : enforceCharLimit(tweet.fullText);
        const { score } = scoreTweet({ ...tweet, fullText }, p);
        return { ...tweet, fullText, score };
      });

      const stillDefective = normalized.filter(t => t.defective);
      if (stillDefective.length > 0) {
        const diagnostics = stillDefective.map(t =>
          `D${t.dayNumber}S${t.tweetOrder}[${t.templateName}] pass2="${t._p2Error}" pass3="${t._p3Error}"`
        );
        console.error('[generation failed] Defective tweets:', diagnostics);
        throw new Error(`Generation could not complete cleanly (${stillDefective.length} tweet${stillDefective.length > 1 ? 's' : ''} remained incomplete). Open browser console (F12) to see the specific error. Please try again.`);
      }

      const startDate = getNextMonday();
      const scheduled = assignSchedule(normalized, startDate, p.timeZone);

      savePreviousWeek(scheduled);
      saveHookHistory(scheduled);
      setTweets(scheduled);
      setIsGenerating(false);
    } catch (err) {
      console.error('Generation error:', err);
      setIsGenerating(false);
      setError(err.message || 'Something went wrong. Please try again.');
      setView('error');
    }
  }, []);

  // ─── Single tweet regeneration ────────────────────────────────────────
  const handleRegenerate = useCallback(async (tweet, instructions = '') => {
    try {
      let fullText;
      if (tweet.defective) {
        // Defective tweet: complete the missing structure using the JSON-returning completion prompt
        // Do NOT enforceCharLimit here — the paragraph-break preference cuts at \n\n,
        // which discards the just-added structural section (same guard as the generation pipeline)
        const raw = await callClaude(buildCompletionPrompt(tweet), { maxTokens: 1000 });
        const result = parseJSON(raw);
        if (!result.fullText) throw new Error('Completion returned empty tweet');
        fullText = cleanTweetArtifacts(result.fullText);
      } else {
        // Normal rewrite: plain-text rewrite prompt
        const raw = await callClaude(buildRegenerateTweetPrompt(tweet, profile, instructions), { maxTokens: 1000 });
        const match = raw.match(/Rewritten Tweet:\s*\n([\s\S]+?)(?:\n\nWhy it's stronger:|$)/i);
        fullText = enforceCharLimit((match?.[1] ?? '').trim());
        if (!fullText) throw new Error('No rewritten tweet found in response');
      }
      const lines = fullText.split('\n').filter(Boolean);
      const updated = {
        fullText,
        hookText: lines[0] ?? '',
        bodyText: lines.slice(1).join('\n'),
        ctaText: tweet.ctaText,
      };
      const { score, breakdown: scoreBreakdown } = scoreTweet(updated, profile);

      setTweets(prev => prev.map(t =>
        t.id === tweet.id
          ? {
              ...t,
              ...updated,
              id: t.id,
              dayNumber: t.dayNumber,
              tweetOrder: t.tweetOrder,
              tweetType: t.tweetType,
              displayTime: t.displayTime,
              scheduledAt: t.scheduledAt,
              timeZone: t.timeZone,
              status: 'draft',
              score,
              scoreBreakdown,
              defective: hasTweetDefect(updated.fullText, t.templateName),
            }
          : t
      ));

      if (editingTweet?.id === tweet.id) {
        setEditingTweet(null);
      }
    } catch (err) {
      console.error('Regenerate error:', err);
      setRegenError('Failed to regenerate tweet. Please try again.');
      setTimeout(() => setRegenError(null), 5000);
    }
  }, [profile, editingTweet]);

  // ─── Tweet mutations ──────────────────────────────────────────────────
  function handleSaveTweet(updated) {
    setTweets(prev => prev.map(t =>
      t.id === updated.id ? { ...t, ...updated, defective: false } : t
    ));
    setEditingTweet(null);
  }

  function handleApprove(tweetId) {
    setTweets(prev => prev.map(t =>
      t.id === tweetId
        ? { ...t, status: t.status === 'approved' ? 'draft' : 'approved' }
        : t
    ));
  }

  function handleApproveAll() {
    setTweets(prev => prev.map(t => ({ ...t, status: 'approved' })));
  }

  function handleUpdateTime(tweetId, displayTime) {
    setTweets(prev => prev.map(t => {
      if (t.id !== tweetId) return t;
      // Parse display time back to a scheduledAt ISO string
      const [timePart, meridiem] = displayTime.split(' ');
      const [h, m] = timePart.split(':').map(Number);
      const hour24 = meridiem === 'PM' && h !== 12 ? h + 12 : meridiem === 'AM' && h === 12 ? 0 : h;
      const date = t.scheduledAt ? new Date(t.scheduledAt) : new Date();
      date.setHours(hour24, m, 0, 0);
      return { ...t, displayTime, scheduledAt: date.toISOString() };
    }));
  }

  // ─── Render ───────────────────────────────────────────────────────────
  if (view === 'error') {
    return (
      <ErrorScreen
        error={error}
        onBack={() => setView('setup')}
        onRetry={() => generateWeek(lastProfile)}
      />
    );
  }

  if (view === 'planner') {
    return (
      <>
        <WeeklyPlanner
          tweets={tweets}
          profile={profile}
          isGenerating={isGenerating}
          regenError={regenError}
          onDismissRegenError={() => setRegenError(null)}
          onEdit={setEditingTweet}
          onRegenerate={(tweet) => handleRegenerate(tweet)}
          onApprove={handleApprove}
          onApproveAll={handleApproveAll}
          onGoToSchedule={() => setView('schedule')}
          onRestart={() => setView('setup')}
          onUpdateTime={handleUpdateTime}
        />
        {editingTweet && (
          <TweetEditor
            tweet={editingTweet}
            profile={profile}
            onSave={handleSaveTweet}
            onRegenerate={handleRegenerate}
            onClose={() => setEditingTweet(null)}
          />
        )}
      </>
    );
  }

  if (view === 'schedule') {
    return (
      <ScheduleReview
        tweets={tweets}
        profile={profile}
        onBack={() => setView('planner')}
      />
    );
  }

  // Default: setup
  return (
    <SetupForm
      onGenerate={generateWeek}
      initialProfile={profile || {}}
    />
  );
}
