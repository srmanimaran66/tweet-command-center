import { useState } from 'react';
import { Clock, Calendar, Send, ArrowLeft, AlertCircle, Copy, Check, ExternalLink } from 'lucide-react';

function openTweetIntent(text) {
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
import { getDayLabel, formatScheduledDate } from '../lib/scheduler.js';

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

  const approved = tweets.filter(t => t.status === 'approved');
  const unapproved = tweets.filter(t => t.status !== 'approved');

  // Group approved tweets by day
  const byDay = {};
  approved.forEach(t => {
    if (!byDay[t.dayNumber]) byDay[t.dayNumber] = [];
    byDay[t.dayNumber].push(t);
  });

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
          <button
            onClick={handleExportAll}
            disabled={approved.length === 0}
            className="flex items-center gap-2 text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl px-4 py-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {exportCopied ? <Check size={15} /> : <Send size={15} />}
            {exportCopied ? 'Copied to clipboard!' : `Export ${approved.length} tweets`}
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
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
                    />
                  ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function ScheduleRow({ tweet, copied, onCopy }) {
  const color = TYPE_COLORS[tweet.tweetType] || '#7c3aed';
  const label = TYPE_LABELS[tweet.tweetType] || 'Tweet';

  return (
    <div className="bg-[#13131f] border border-white/[0.06] rounded-xl p-4 flex gap-3">
      {/* Type indicator */}
      <div
        className="w-1 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-medium" style={{ color }}>
            {label}
          </span>
          <span className="text-slate-600 text-xs">·</span>
          <Clock size={10} className="text-slate-600" />
          <span className="text-slate-500 text-xs">{tweet.displayTime}</span>
        </div>
        <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-line line-clamp-3">
          {tweet.fullText}
        </p>
      </div>

      <div className="flex flex-col gap-1.5 flex-shrink-0 self-start">
        <button
          onClick={() => openTweetIntent(tweet.fullText)}
          className="flex items-center gap-1.5 text-xs font-medium text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 rounded-lg px-3 py-1.5 transition-all"
          title="Open in X/Twitter to post now"
        >
          <ExternalLink size={12} />
          Post now
        </button>
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

function SumStat({ label, value }) {
  return (
    <div className="text-center">
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-slate-500 text-xs mt-0.5">{label}</div>
    </div>
  );
}
