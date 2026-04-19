import { useState, useEffect } from 'react';
import { CheckCircle, Calendar, ArrowRight, RotateCcw, ClipboardCopy, Sparkles } from 'lucide-react';

const GENERATION_MESSAGES = [
  'Analyzing your target audience and tone...',
  'Selecting high-converting hook templates...',
  'Drafting 15 unique posts for your niche...',
  'Applying formatting guardrails for readability...',
  'Running final algorithmic score checks...',
  'Almost there — polishing the final cards...',
];

function GenerationToast({ isGenerating }) {
  const [msgIndex, setMsgIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isGenerating) {
      setVisible(true);
      setMsgIndex(0);
    } else {
      // Fade out after generation completes
      const t = setTimeout(() => setVisible(false), 1500);
      return () => clearTimeout(t);
    }
  }, [isGenerating]);

  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(() => {
      setMsgIndex(i => Math.min(i + 1, GENERATION_MESSAGES.length - 1));
    }, 3500);
    return () => clearInterval(interval);
  }, [isGenerating]);

  if (!visible) return null;

  return (
    <div className={`fixed bottom-6 right-6 z-50 transition-all duration-500 ${isGenerating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
      <div className="bg-[#1a1a2e] border border-violet-500/40 rounded-2xl px-5 py-4 shadow-2xl flex items-start gap-3 max-w-xs">
        <div className="mt-0.5 flex-shrink-0">
          <div className="w-5 h-5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
        </div>
        <div>
          <p className="text-white text-xs font-semibold mb-0.5 flex items-center gap-1.5">
            <Sparkles size={11} className="text-violet-400" />
            Generating your week
          </p>
          <p className="text-slate-400 text-xs leading-snug transition-all duration-500">
            {GENERATION_MESSAGES[msgIndex]}
          </p>
        </div>
      </div>
    </div>
  );
}
import TweetCard from './TweetCard.jsx';
import { getDayLabel, formatScheduledDate } from '../lib/scheduler.js';

export default function WeeklyPlanner({ tweets, profile, isGenerating, onEdit, onRegenerate, onApprove, onApproveAll, onGoToSchedule, onRestart, onUpdateTime }) {
  const [filter, setFilter] = useState('all'); // all | draft | approved
  const [copied, setCopied] = useState(false);

  function handleCopyJSON() {
    const data = tweets.map(t => ({
      day: t.dayNumber,
      slot: t.tweetOrder,
      type: t.tweetType,
      template: t.templateName,
      hookType: t.hookType,
      text: t.fullText,
      score: t.score,
      status: t.status,
    }));
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const days = [1, 2, 3, 4, 5];
  const approvedCount = tweets.filter(t => t.status === 'approved').length;
  const totalCount = tweets.length;

  function getTweetsForDay(dayNumber) {
    return tweets
      .filter(t => t.dayNumber === dayNumber)
      .filter(t => filter === 'all' || t.status === filter)
      .sort((a, b) => a.tweetOrder - b.tweetOrder);
  }

  const firstTweet = tweets.find(t => t.dayNumber === 1);
  const lastTweet = tweets.find(t => t.dayNumber === 5 && t.tweetOrder === 3);

  return (
    <div className="min-h-screen bg-[#0a0a12]">
      <GenerationToast isGenerating={isGenerating} />

      {/* Header */}
      <div className="border-b border-white/[0.06] bg-[#0d0d18] sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto px-4 py-4 flex items-center gap-4">
          <div className="flex-1">
            <h1 className="text-white font-semibold text-lg">5-Day Content Plan</h1>
            <p className="text-slate-500 text-xs mt-0.5">
              {profile.primaryTopic} · {profile.secondaryTopic}
              {firstTweet && ` · ${formatScheduledDate(firstTweet.scheduledAt)}`}
              {lastTweet && ` → ${formatScheduledDate(lastTweet.scheduledAt)}`}
            </p>
          </div>

          {/* Stats */}
          <div className="hidden sm:flex items-center gap-4 text-sm">
            <Stat label="Total" value={totalCount} />
            <Stat label="Approved" value={approvedCount} accent />
            <Stat label="Remaining" value={totalCount - approvedCount} />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onRestart}
              className="text-slate-500 hover:text-slate-300 p-2 rounded-lg hover:bg-white/[0.04] transition-all"
              title="Start over"
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={handleCopyJSON}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white border border-white/[0.08] hover:border-white/20 rounded-xl px-3 py-2 transition-all"
              title="Copy tweets as JSON"
            >
              <ClipboardCopy size={13} />
              {copied ? 'Copied!' : 'Copy JSON'}
            </button>
            <button
              onClick={onApproveAll}
              className="hidden sm:flex items-center gap-1.5 text-sm text-slate-300 hover:text-white border border-white/[0.08] hover:border-white/20 rounded-xl px-3 py-2 transition-all"
            >
              <CheckCircle size={15} />
              Approve all
            </button>
            <button
              onClick={onGoToSchedule}
              disabled={approvedCount === 0}
              className="flex items-center gap-1.5 text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-xl px-4 py-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Schedule {approvedCount > 0 ? `(${approvedCount})` : ''}
              <ArrowRight size={15} />
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="max-w-[1400px] mx-auto px-4 pb-3 flex items-center gap-1">
          {['all', 'draft', 'approved'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                filter === f
                  ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {f}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 text-xs text-slate-500 sm:hidden">
            <span>{approvedCount}/{totalCount} approved</span>
          </div>
        </div>
      </div>

      {/* 7-column grid */}
      <div className="max-w-[1400px] mx-auto px-4 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {days.map(dayNum => {
            const dayTweets = getTweetsForDay(dayNum);
            const allApproved = dayTweets.length > 0 && dayTweets.every(t => t.status === 'approved');
            const firstDayTweet = tweets.find(t => t.dayNumber === dayNum);

            return (
              <div key={dayNum} className="flex flex-col gap-3">
                {/* Day header */}
                <div className={`rounded-xl p-3 border ${allApproved ? 'bg-emerald-950/30 border-emerald-500/25' : 'bg-white/[0.02] border-white/[0.05]'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm font-semibold">{getDayLabel(dayNum)}</span>
                    {allApproved && <CheckCircle size={13} className="text-emerald-400" />}
                  </div>
                  {firstDayTweet && (
                    <p className="text-slate-600 text-xs mt-0.5 flex items-center gap-1">
                      <Calendar size={10} />
                      {formatScheduledDate(firstDayTweet.scheduledAt)}
                    </p>
                  )}
                </div>

                {/* Tweet cards */}
                {dayTweets.length > 0 ? (
                  dayTweets.map(tweet => (
                    <TweetCard
                      key={tweet.id}
                      tweet={tweet}
                      onEdit={onEdit}
                      onRegenerate={onRegenerate}
                      onApprove={onApprove}
                      onUpdateTime={onUpdateTime}
                    />
                  ))
                ) : (
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-4 text-center">
                    <p className="text-slate-600 text-xs">No tweets match filter</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile bottom bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-[#0d0d18] border-t border-white/[0.06] p-4 flex gap-3">
        <button
          onClick={onApproveAll}
          className="flex-1 flex items-center justify-center gap-2 text-sm text-slate-300 border border-white/[0.08] rounded-xl py-2.5"
        >
          <CheckCircle size={15} />
          Approve all
        </button>
        <button
          onClick={onGoToSchedule}
          className="flex-1 flex items-center justify-center gap-2 text-sm font-medium bg-violet-600 text-white rounded-xl py-2.5"
        >
          Schedule
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="text-center">
      <div className={`font-semibold ${accent ? 'text-emerald-400' : 'text-white'}`}>{value}</div>
      <div className="text-slate-500 text-xs">{label}</div>
    </div>
  );
}
