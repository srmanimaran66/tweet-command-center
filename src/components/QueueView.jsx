import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Clock, Calendar, Check, Send, ExternalLink, Link2, Inbox } from 'lucide-react';

function formatDate(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  });
}

function formatPostedAt(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function QueueView({ onBack }) {
  const [xConnected, setXConnected] = useState(null);
  const [status, setStatus] = useState(null);   // { queued, posted, pending, tweets }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    Promise.all([
      fetch('/api/auth/x/status').then(r => r.json()).catch(() => ({ connected: false })),
      fetch('/api/schedule/status').then(r => r.json()).catch(() => null),
    ]).then(([auth, queue]) => {
      setXConnected(auth.connected);
      setStatus(queue);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const tweets = status?.tweets || [];

  // Group by calendar date of scheduledAt
  const byDate = {};
  tweets
    .slice()
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
    .forEach(t => {
      const dateKey = (t.scheduledAt || '').slice(0, 10);
      if (!byDate[dateKey]) byDate[dateKey] = [];
      byDate[dateKey].push(t);
    });

  const pendingCount = tweets.filter(t => !t.posted).length;
  const postedCount  = tweets.filter(t => t.posted).length;

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
            <h1 className="text-white font-semibold">Scheduled Queue</h1>
            {status && (
              <p className="text-slate-500 text-xs mt-0.5">
                {postedCount} posted · {pendingCount} pending
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">

        {/* X connection banner */}
        {xConnected === false && (
          <div className="bg-[#13131f] border border-white/[0.08] rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-white text-sm font-medium">Connect X to post directly</p>
              <p className="text-slate-500 text-xs mt-0.5">
                Connect your X account to use Post now — otherwise tweets open in your browser.
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

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-white/10 border-t-violet-500 rounded-full animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && tweets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="w-12 h-12 bg-white/[0.04] rounded-full flex items-center justify-center">
              <Inbox size={20} className="text-slate-500" />
            </div>
            <p className="text-slate-400 text-sm">No tweets scheduled yet.</p>
            <button
              onClick={onBack}
              className="text-violet-400 hover:text-violet-300 text-sm mt-1"
            >
              Generate a week of content
            </button>
          </div>
        )}

        {/* Tweet groups */}
        {!loading && Object.keys(byDate).map(dateKey => (
          <div key={dateKey}>
            <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
              <Calendar size={12} />
              {formatDate(dateKey)}
            </h2>
            <div className="space-y-2">
              {byDate[dateKey].map(tweet => (
                <QueueRow
                  key={tweet.id}
                  tweet={tweet}
                  xConnected={xConnected}
                  onPosted={refresh}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QueueRow({ tweet, xConnected, onPosted }) {
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState(null);
  const [localPosted, setLocalPosted] = useState(tweet.posted);
  const [xTweetId, setXTweetId] = useState(tweet.xTweetId || null);

  const isPosted = localPosted;
  const tweetUrl = xTweetId ? `https://x.com/i/web/status/${xTweetId}` : null;

  async function handlePostNow() {
    setPosting(true);
    setPostError(null);
    try {
      const res = await fetch('/api/schedule/post-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tweet.id, text: tweet.text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.hint ? `${data.error} — ${data.hint}` : (data.error || 'Post failed'));
      setLocalPosted(true);
      setXTweetId(data.xTweetId);
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
      <div className={`w-1 rounded-full flex-shrink-0 ${isPosted ? 'bg-emerald-500' : 'bg-violet-500'}`} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <Clock size={10} className="text-slate-600" />
          <span className="text-slate-500 text-xs">{tweet.displayTime}</span>
          {isPosted ? (
            <span className="text-emerald-500 text-xs flex items-center gap-1">
              <Check size={10} />
              {tweetUrl
                ? <a href={tweetUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    Posted {tweet.postedAt ? `· ${formatPostedAt(tweet.postedAt)}` : ''}
                  </a>
                : <>Posted {tweet.postedAt ? `· ${formatPostedAt(tweet.postedAt)}` : ''}</>
              }
            </span>
          ) : (
            <span className="text-violet-400 text-xs">· Queued</span>
          )}
        </div>

        <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-line line-clamp-4">
          {tweet.text}
        </p>

        {postError && (
          <p className="text-red-400 text-xs mt-1.5">{postError}</p>
        )}
      </div>

      {!isPosted && (
        <div className="flex-shrink-0 self-start">
          {xConnected ? (
            <button
              onClick={handlePostNow}
              disabled={posting}
              className="flex items-center gap-1.5 text-xs font-medium text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 rounded-lg px-3 py-1.5 transition-all disabled:opacity-40"
            >
              {posting
                ? <><div className="w-3 h-3 border-2 border-sky-400/40 border-t-sky-400 rounded-full animate-spin" /> Posting…</>
                : <><Send size={12} /> Post now</>
              }
            </button>
          ) : (
            <button
              onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet.text)}`, '_blank', 'noopener,noreferrer')}
              className="flex items-center gap-1.5 text-xs font-medium text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 rounded-lg px-3 py-1.5 transition-all"
            >
              <ExternalLink size={12} />
              Post now
            </button>
          )}
        </div>
      )}

      {isPosted && tweetUrl && (
        <div className="flex-shrink-0 self-start">
          <a
            href={tweetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 border border-white/[0.06] rounded-lg px-3 py-1.5 transition-all"
          >
            <ExternalLink size={12} />
            View
          </a>
        </div>
      )}
    </div>
  );
}
