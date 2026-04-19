import { useState, useRef, useEffect } from 'react';
import { Edit3, RefreshCw, CheckCircle, Clock, Star, Pencil, ExternalLink, MoreHorizontal } from 'lucide-react';

function openTweetIntent(text) {
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
import { getScoreLabel } from '../lib/scoring.js';

const TYPE_CONFIG = {
  primary_educational:   { label: 'Primary',    color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.25)' },
  secondary_educational: { label: 'Secondary',  color: '#14b8a6', bg: 'rgba(20,184,166,0.12)',  border: 'rgba(20,184,166,0.25)' },
  engagement:            { label: 'Engagement', color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.25)' },
};

const TIME_OPTIONS = [
  '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
  '12:00 PM', '12:15 PM', '1:00 PM', '2:00 PM', '3:00 PM',
  '3:10 PM', '4:00 PM', '5:00 PM', '5:40 PM', '6:00 PM',
  '7:00 PM', '8:00 PM', '9:00 PM',
];

function SkeletonCard({ tweet }) {
  const type = TYPE_CONFIG[tweet.tweetType] || TYPE_CONFIG.primary_educational;
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#13131f] p-4 flex flex-col gap-3 animate-pulse">
      {/* Type badge + time */}
      <div className="flex items-center justify-between">
        <div
          className="h-5 w-16 rounded-full opacity-40"
          style={{ backgroundColor: type.bg, border: `1px solid ${type.border}` }}
        />
        <div className="h-3 w-12 rounded bg-white/[0.06]" />
      </div>
      {/* Text lines */}
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-white/[0.06]" />
        <div className="h-3 w-5/6 rounded bg-white/[0.06]" />
        <div className="h-3 w-4/6 rounded bg-white/[0.06]" />
        <div className="h-3 w-3/5 rounded bg-white/[0.06]" />
      </div>
      {/* Score row */}
      <div className="flex items-center justify-between">
        <div className="h-3 w-24 rounded bg-white/[0.06]" />
        <div className="h-3 w-10 rounded bg-white/[0.06]" />
      </div>
      {/* Score bar */}
      <div className="h-1 w-full rounded-full bg-white/[0.05]">
        <div className="h-full w-1/3 rounded-full" style={{ backgroundColor: type.border }} />
      </div>
      {/* Action row */}
      <div className="flex items-center gap-2 pt-1">
        <div className="h-6 w-16 rounded-lg bg-white/[0.06]" />
        <div className="h-6 w-12 rounded-lg bg-white/[0.06] ml-auto" />
        <div className="h-6 w-12 rounded-lg bg-white/[0.06]" />
      </div>
    </div>
  );
}

export default function TweetCard({ tweet, onEdit, onRegenerate, onApprove, onUpdateTime }) {
  if (tweet.skeleton) return <SkeletonCard tweet={tweet} />;

  const type = TYPE_CONFIG[tweet.tweetType] || TYPE_CONFIG.primary_educational;
  const scoreInfo = getScoreLabel(tweet.score || 70);
  const isApproved = tweet.status === 'approved';
  const charCount = (tweet.fullText || '').length;
  const overLimit = charCount > 280;

  const [showFull, setShowFull] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showPostMenu, setShowPostMenu] = useState(false);
  const [isRedoing, setIsRedoing] = useState(false);
  const postMenuRef = useRef(null);
  const hoverTimeout = useRef(null);

  useEffect(() => {
    if (!showPostMenu) return;
    function handleClick(e) {
      if (postMenuRef.current && !postMenuRef.current.contains(e.target)) {
        setShowPostMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPostMenu]);

  function handleMouseEnter() {
    hoverTimeout.current = setTimeout(() => setShowFull(true), 300);
  }
  function handleMouseLeave() {
    clearTimeout(hoverTimeout.current);
    setShowFull(false);
  }

  function handleTimeSelect(time) {
    setShowTimePicker(false);
    if (onUpdateTime) onUpdateTime(tweet.id, time);
  }

  const isDefective = tweet.defective;

  return (
    <div
      className={`relative rounded-xl border p-4 flex flex-col gap-3 transition-all ${
        isDefective
          ? 'bg-amber-950/20 border-amber-500/40'
          : isApproved
          ? 'bg-emerald-950/20 border-emerald-500/30'
          : 'bg-[#13131f] border-white/[0.06] hover:border-white/[0.12]'
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Hover expand — full text popover (floats above the card so buttons stay clickable) */}
      {showFull && (
        <div className="absolute inset-x-0 bottom-full mb-1 z-30 bg-[#1c1c2e] border border-violet-500/30 rounded-xl p-4 shadow-2xl pointer-events-none">
          <p className="text-slate-100 text-xs leading-relaxed whitespace-pre-line">
            {tweet.fullText}
          </p>
          {overLimit && (
            <p className="text-red-400 text-xs mt-2 font-medium">
              ⚠ Over limit · {charCount}/280 chars — click Redo to fix
            </p>
          )}
        </div>
      )}

      {/* Defect banner */}
      {isDefective && (
        <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-lg px-2.5 py-1.5">
          <span>⚠</span>
          <span>Incomplete generation — hit Redo</span>
        </div>
      )}

      {/* Top row: type badge + [approved icon] + time */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ color: type.color, backgroundColor: type.bg, border: `1px solid ${type.border}` }}
          >
            {type.label}
          </span>
          {isApproved && (
            <button
              onClick={() => onApprove(tweet.id)}
              title="Approved — click to unapprove"
              className="text-emerald-400 hover:text-slate-400 transition-colors"
            >
              <CheckCircle size={15} />
            </button>
          )}
        </div>

        {/* Time — click to edit */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowTimePicker(v => !v); }}
            className="flex items-center gap-1 text-slate-500 text-xs hover:text-slate-300 transition-colors group"
          >
            <Clock size={11} />
            <span>{tweet.displayTime || '12:15 PM'}</span>
            <Pencil size={9} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          {showTimePicker && (
            <div
              className="absolute right-0 top-6 z-40 bg-[#1c1c2e] border border-white/[0.12] rounded-xl shadow-2xl py-1 w-28 max-h-48 overflow-y-auto"
              onMouseLeave={() => setShowTimePicker(false)}
            >
              {TIME_OPTIONS.map(t => (
                <button
                  key={t}
                  onClick={() => handleTimeSelect(t)}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                    t === tweet.displayTime
                      ? 'text-violet-300 bg-violet-500/10'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tweet text — 4-line clamp, hover reveals full text above */}
      <p className="text-slate-200 text-sm leading-relaxed line-clamp-4 whitespace-pre-line">
        {tweet.fullText || 'No content yet.'}
      </p>

      {/* Score + thread/char indicator */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <Star size={11} style={{ color: scoreInfo.color }} />
          <span style={{ color: scoreInfo.color }} className="font-medium">
            {tweet.score || 0}
          </span>
          <span className="text-slate-600">/ 100 · {scoreInfo.label}</span>
        </div>

        {charCount > 280 ? (
          <span className="text-red-400 font-medium">
            ⚠ {charCount}/280
          </span>
        ) : (
          <span className="text-slate-600">
            {charCount}/280
          </span>
        )}
      </div>

      {/* Score bar */}
      <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${tweet.score || 0}%`, backgroundColor: scoreInfo.color }}
        />
      </div>

      {/* CTA text */}
      {tweet.ctaText && (
        <p className="text-xs text-slate-500 italic truncate">
          CTA: "{tweet.ctaText}"
        </p>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {!isApproved && (
          <button
            onClick={() => onApprove(tweet.id)}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-emerald-400 transition-colors border border-white/[0.06] hover:border-emerald-500/40 rounded-lg px-2.5 py-1.5"
          >
            <CheckCircle size={13} />
            Approve
          </button>
        )}

        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={() => onEdit(tweet)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors border border-white/[0.06] hover:border-white/20 rounded-lg px-2.5 py-1.5"
          >
            <Edit3 size={12} />
            Edit
          </button>
          <button
            onClick={async () => { setIsRedoing(true); try { await onRegenerate(tweet); } finally { setIsRedoing(false); } }}
            disabled={isRedoing}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-violet-400 transition-colors border border-white/[0.06] hover:border-violet-500/40 rounded-lg px-2.5 py-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw size={12} className={isRedoing ? 'animate-spin' : ''} />
            {isRedoing ? 'Redoing…' : 'Redo'}
          </button>

          {/* More menu — contains Post Now */}
          <div className="relative" ref={postMenuRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowPostMenu(v => !v); }}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors border border-white/[0.06] hover:border-white/20 rounded-lg px-2 py-1.5"
              title="More actions"
            >
              <MoreHorizontal size={13} />
            </button>
            {showPostMenu && (
              <div className="absolute right-0 bottom-8 z-40 bg-[#1c1c2e] border border-white/[0.12] rounded-xl shadow-2xl py-1 w-32">
                <button
                  onClick={() => { openTweetIntent(tweet.fullText); setShowPostMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-sky-400 hover:bg-white/[0.04] transition-colors"
                >
                  <ExternalLink size={12} />
                  Post Now
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
