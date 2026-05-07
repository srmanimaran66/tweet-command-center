import { useState, useEffect } from 'react';
import { Clock, Calendar, Send, ArrowLeft, AlertCircle, Copy, Check, ExternalLink, Zap, Link2, RefreshCw } from 'lucide-react';
import { assignSchedule, getDayLabel, formatScheduledDate } from '../lib/scheduler.js';

function getCurrentMonday() {
  const now = new Date();
  const day = now.getDay();
  const daysBack = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysBack);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

function openTweetIntent(text) {
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

const TYPE_COLORS = {
  primary_educational: '#3b82f6',
  secondary_educational: '#14b8a6',
  engagement: '#f97316',
};

const TYPE_LABELS = {
  primary_educational: 'Primary',
  secondary_educational: 'Secondary',
  engagement: 'Engagement',
};

export default function ScheduleReview({ tweets, profile, onBack }) {
  const [exportCopied, setExportCopied] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // X connection state
  const [xConnected, setXConnected] = useState(null); // null = loading
  const [xScheduling, setXScheduling] = useState(false);
  const [xScheduled, setXScheduled] = useState(false);
  const [xError, setXError] = useState(null);
  const [queueStatus, setQueueStatus] = useState(null); // { queued, posted, pending }

  // Reschedule state
  const [localTweets, setLocalTweets] = useState(tweets);
  const [rescheduleDate, setRescheduleDate] = useState(getCurrentMonday);
  const [rescheduling, setRescheduling] = useState(false);

  const approved = localTweets.filter(t => t.status === 'approved');
  const unapproved = localTweets.filter(t => t.status !== 'approved');

  const byDay = {};
  approved.forEach(t => {
    if (!byDay[t.dayNumber]) byDay[t.dayNumber] = [];
    byDay[t.dayNumber].push(t);
  });

  useEffect(() => {
    fetch('/api/auth/x/status')
      .then(r => r.json())
      .then(d => {
        setXConnected(d.connected);
        if (d.connected) fetchQueueStatus();
      })
      .catch(() => setXConnected(false));
  }, []);

  function fetchQueueStatus() {
    fetch('/api/schedule/status')
      .then(r => r.json())
      .then(d => setQueueStatus(d))
      .catch(() => {});
  }

  async function handleCopy(tweet) {
    await navigator.clipboard.writeText(tweet.fullText);
    setCopiedId(tweet.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleExportAll() {
    const lines = [];
    Object.keys(byDay)
      .sort((a, b) => Number(a) - Number(b))
      .forEach(dayNum => {
        const dayTweets = byDay[dayNum].slice().sort((a, b) => a.tweetOrder - b.tweetOrder);
        lines.push(`=== ${getDayLabel(Number(dayNum))} ===`);
        dayTweets.forEach(t => {
          lines.push(`[${t.displayTime}]`);
          lines.push(t.fullText);
          lines.push('');
        });
      });
    await navigator.clipboard.writeText(lines.join('\n'));
    setExportCopied(true);
    setTimeout(() => setExportCopied(false), 2500);
  }

  async function handleScheduleToX() {
    setXScheduling(true);
    setXError(null);
    try {
      const res = await fetch('/api/schedule/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tweets: approved }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scheduling failed');
      setXScheduled(true);
      fetchQueueStatus();
    } catch (err) {
      setXError(err.message);
    } finally {
      setXScheduling(false);
    }
  }

  async function handleDisconnect() {
    await fetch('/api/auth/x/disconnect', { method: 'POST' });
    setXConnected(false);
    setXScheduled(false);
    setQueueStatus(null);
  }

  async function handleReschedule() {
    setRescheduling(true);
    setXError(null);
    try {
      const rescheduled = assignSchedule(approved, rescheduleDate, profile.timeZone || 'America/New_York');
      const res = await fetch('/api/schedule/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tweets: rescheduled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reschedule failed');
      setLocalTweets(prev => prev.map(t => {
        const updated = rescheduled.find(r => r.id === t.id);
        return updated ? { ...t, scheduledAt: updated.scheduledAt, displayTime: updated.displayTime } : t;
      }));
      fetchQueueStatus();
    } catch (err) {
      setXError(err.message);
    } finally {
      setRescheduling(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a12]">
      {/* Header */}
      <div className="border-b border-white/[0.06] bg-[#0d0d18] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-slate-500 hover:text-white p-2 rounded-lg hover:bg-white/[0.04] transition-all"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-white font-semibold">Schedule Review</h1>
            <p className="text-slate-500 text-xs mt-0.5">
              {approved.length} approved · {unapproved.length} pending review
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Export to clipboard — always available */}
            <button
              onClick={handleExportAll}
              disabled={approved.length === 0}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white border border-white/[0.08] hover:border-white/[0.16] rounded-xl px-3 py-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {exportCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              {exportCopied ? 'Copied!' : 'Export'}
            </button>

            {/* Schedule to X — when connected */}
            {xConnected && (
              <button
                onClick={handleScheduleToX}
                disabled={approved.length === 0 || xScheduling || xScheduled}
                className="flex items-center gap-2 text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl px-4 py-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {xScheduled
                  ? <><Check size={14} /> Scheduled!</>
                  : xScheduling
                  ? <><div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Queuing…</>
                  : <><Zap size={14} /> Schedule to X</>
                }
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">

        {/* X connection banner */}
        {xConnected === false && (
          <div className="bg-[#13131f] border border-white/[0.08] rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-white text-sm font-medium">Auto-schedule to X</p>
              <p className="text-slate-500 text-xs mt-0.5">
                Connect your X account to post tweets automatically at their scheduled times.
              </p>
            </div>
            <a
              href="/api/auth/x/connect"
              className="flex items-center gap-2 text-sm font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-xl px-4 py-2 transition-colors whitespace-nowrap flex-shrink-0"
            >
              <Link2 size={14} />
              Connect X
            </a>
          </div>
        )}

        {xConnected && (
          <div className="flex items-center justify-between bg-emerald-950/30 border border-emerald-500/25 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              Connected to X
              {queueStatus && queueStatus.queued > 0 && (
                <span className="text-slate-500 text-xs ml-1">
                  · {queueStatus.posted}/{queueStatus.queued} tweets posted
                </span>
              )}
            </div>
            <button
              onClick={handleDisconnect}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Disconnect
            </button>
          </div>
        )}

        {/* Scheduled confirmation */}
        {xScheduled && (
          <div className="bg-violet-950/30 border border-violet-500/25 rounded-xl px-4 py-3 flex items-center gap-3">
            <Check size={15} className="text-violet-400 flex-shrink-0" />
            <p className="text-violet-300 text-sm">
              {approved.length} tweets queued — they'll post automatically at their scheduled times.
            </p>
          </div>
        )}

        {/* Reschedule — shown whenever tweets are queued */}
        {xConnected && (xScheduled || (queueStatus && queueStatus.pending > 0)) && (
          <div className="bg-[#13131f] border border-white/[0.06] rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
            <Calendar size={14} className="text-slate-500 flex-shrink-0" />
            <span className="text-slate-400 text-sm">Week starts</span>
            <input
              type="date"
              value={rescheduleDate}
              onChange={e => setRescheduleDate(e.target.value)}
              className="bg-[#0d0d18] border border-white/[0.08] rounded-lg px-3 py-1.5 text-slate-200 text-sm focus:outline-none focus:border-violet-500/50"
            />
            <button
              onClick={handleReschedule}
              disabled={rescheduling || !rescheduleDate}
              className="flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-300 border border-violet-500/30 hover:border-violet-500/50 bg-violet-500/10 hover:bg-violet-500/15 rounded-lg px-3 py-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {rescheduling
                ? <><div className="w-3 h-3 border-2 border-violet-400/40 border-t-violet-400 rounded-full animate-spin" /> Updating…</>
                : <><RefreshCw size={13} /> Reschedule</>
              }
            </button>
          </div>
        )}

        {/* X error */}
        {xError && (
          <div className="bg-red-950/30 border border-red-500/25 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-red-300 text-sm">{xError}</p>
            <button onClick={() => setXError(null)} className="text-xs text-red-400 hover:text-red-200">Dismiss</button>
          </div>
        )}

        {/* Warning for unapproved */}
        {unapproved.length > 0 && (
          <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-amber-300 text-sm font-medium">
                {unapproved.length} tweet{unapproved.length > 1 ? 's' : ''} not yet approved
              </p>
              <p className="text-amber-400/70 text-xs mt-0.5">
                Only approved tweets will be scheduled. Go back to approve more.
              </p>
            </div>
          </div>
        )}

        {approved.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-400 mb-2">No approved tweets yet.</p>
            <button
              onClick={onBack}
              className="text-violet-400 hover:text-violet-300 text-sm flex items-center gap-2 mx-auto"
            >
              <ArrowLeft size={14} />
              Back to planner to approve tweets
            </button>
          </div>
        )}

        {/* Day groups */}
        {Object.keys(byDay)
          .sort((a, b) => Number(a) - Number(b))
          .map(dayNum => (
            <div key={dayNum}>
              <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                <Calendar size={12} />
                {getDayLabel(Number(dayNum))} — {formatScheduledDate(byDay[dayNum][0].scheduledAt)}
              </h2>
              <div className="space-y-2">
                {byDay[dayNum]
                  .sort((a, b) => a.tweetOrder - b.tweetOrder)
                  .map(tweet => (
                    <ScheduleRow
                      key={tweet.id}
                      tweet={tweet}
                      copied={copiedId === tweet.id}
                      onCopy={() => handleCopy(tweet)}
                      queueStatus={queueStatus}
                      xConnected={xConnected}
                      onPosted={fetchQueueStatus}
                    />
                  ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function ScheduleRow({ tweet, copied, onCopy, queueStatus, xConnected, onPosted }) {
  const color = TYPE_COLORS[tweet.tweetType] || '#7c3aed';
  const label = TYPE_LABELS[tweet.tweetType] || 'Tweet';
  const queued = queueStatus?.tweets?.find(t => t.id === tweet.id);

  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState(null);
  const [postedId, setPostedId] = useState(queued?.xTweetId || null);

  const isPosted = queued?.posted || !!postedId;

  async function handlePostNow() {
    setPosting(true);
    setPostError(null);
    try {
      const res = await fetch('/api/schedule/post-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tweet.id, text: tweet.fullText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.hint ? `${data.error} — ${data.hint}` : (data.error || 'Post failed'));
      setPostedId(data.xTweetId);
      onPosted?.();
    } catch (err) {
      setPostError(err.message);
      setTimeout(() => setPostError(null), 4000);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="bg-[#13131f] border border-white/[0.06] rounded-xl p-4 flex gap-3">
      <div className="w-1 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-medium" style={{ color }}>{label}</span>
          <span className="text-slate-600 text-xs">·</span>
          <Clock size={10} className="text-slate-600" />
          <span className="text-slate-500 text-xs">{tweet.displayTime}</span>
          {isPosted && (
            <span className="text-emerald-500 text-xs flex items-center gap-1 ml-1">
              <Check size={10} />
              {postedId
                ? <a href={`https://x.com/i/web/status/${postedId}`} target="_blank" rel="noopener noreferrer" className="hover:underline">Posted</a>
                : 'Posted'
              }
            </span>
          )}
          {queued && !isPosted && (
            <span className="text-violet-400 text-xs ml-1">· Queued</span>
          )}
        </div>
        <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-line line-clamp-3">
          {tweet.fullText}
        </p>
        {postError && (
          <p className="text-red-400 text-xs mt-1.5">{postError}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5 flex-shrink-0 self-start">
        {xConnected ? (
          <button
            onClick={handlePostNow}
            disabled={posting || isPosted}
            className="flex items-center gap-1.5 text-xs font-medium text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 rounded-lg px-3 py-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {posting
              ? <><div className="w-3 h-3 border-2 border-sky-400/40 border-t-sky-400 rounded-full animate-spin" /> Posting…</>
              : isPosted
              ? <><Check size={12} /> Posted</>
              : <><Send size={12} /> Post now</>
            }
          </button>
        ) : (
          <button
            onClick={() => openTweetIntent(tweet.fullText)}
            className="flex items-center gap-1.5 text-xs font-medium text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 rounded-lg px-3 py-1.5 transition-all"
            title="Open in X/Twitter to post now"
          >
            <ExternalLink size={12} />
            Post now
          </button>
        )}
        <button
          onClick={onCopy}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white hover:bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5 transition-all"
          title="Copy tweet text"
        >
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
