'use client';
// app/feedback/page.tsx
// Feature Request Hub — operators submit ideas, admins review + triage weekly

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';

// ── Types ──────────────────────────────────────────────────────────────────────

type Status   = 'pending' | 'in_review' | 'accepted' | 'shipped' | 'declined';
type Priority = 'low' | 'normal' | 'high' | 'critical';
type Category = 'general' | 'ui' | 'comms' | 'patrol' | 'alarms' | 'reporting' | 'integration' | 'other';

interface FeatureRequest {
  id:              string;
  title:           string;
  description:     string | null;
  category:        Category;
  priority:        Priority;
  status:          Status;
  submitted_by:    string;
  submitted_by_id: string | null;
  admin_notes:     string | null;
  created_at:      string;
  updated_at:      string;
}

// ── Config ─────────────────────────────────────────────────────────────────────

const CATEGORIES: { value: Category; label: string; icon: string }[] = [
  { value: 'general',     label: 'General',          icon: '💡' },
  { value: 'ui',          label: 'UI / UX',           icon: '🎨' },
  { value: 'comms',       label: 'Comms / Dialer',    icon: '📞' },
  { value: 'patrol',      label: 'Patrol',            icon: '🚶' },
  { value: 'alarms',      label: 'Alarms',            icon: '🚨' },
  { value: 'reporting',   label: 'Reporting',         icon: '📊' },
  { value: 'integration', label: 'Integration',       icon: '🔌' },
  { value: 'other',       label: 'Other',             icon: '📝' },
];

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'low',      label: 'Low',      color: 'text-slate-400  border-slate-500/40  bg-slate-500/10'  },
  { value: 'normal',   label: 'Normal',   color: 'text-blue-400   border-blue-500/40   bg-blue-500/10'   },
  { value: 'high',     label: 'High',     color: 'text-amber-400  border-amber-500/40  bg-amber-500/10'  },
  { value: 'critical', label: 'Critical', color: 'text-red-400    border-red-500/40    bg-red-500/10'    },
];

const STATUSES: { value: Status; label: string; color: string; dot: string }[] = [
  { value: 'pending',   label: 'Pending',   color: 'text-slate-400',  dot: 'bg-slate-500'  },
  { value: 'in_review', label: 'In Review', color: 'text-amber-400',  dot: 'bg-amber-400'  },
  { value: 'accepted',  label: 'Accepted',  color: 'text-emerald-400',dot: 'bg-emerald-400'},
  { value: 'shipped',   label: 'Shipped 🚀',color: 'text-indigo-400', dot: 'bg-indigo-400' },
  { value: 'declined',  label: 'Declined',  color: 'text-red-400',    dot: 'bg-red-500'    },
];

function priorityStyle(p: Priority) {
  return PRIORITIES.find(x => x.value === p)?.color ?? '';
}
function statusStyle(s: Status) {
  return STATUSES.find(x => x.value === s)?.color ?? 'text-slate-400';
}
function statusDot(s: Status) {
  return STATUSES.find(x => x.value === s)?.dot ?? 'bg-slate-500';
}
function categoryIcon(c: Category) {
  return CATEGORIES.find(x => x.value === c)?.icon ?? '💡';
}

const DATE_FILTER_OPTIONS = [
  { value: '7',  label: 'Last 7 days'  },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '0',  label: 'All time'     },
];

// ── Main Component ─────────────────────────────────────────────────────────────

export default function FeedbackPage() {
  const { user } = useUser();
  const operatorName = user?.firstName ?? user?.emailAddresses?.[0]?.emailAddress?.split('@')[0] ?? 'Operator';
  const role = (user?.publicMetadata?.role as string) ?? 'agent';
  const isAdmin = role === 'admin' || role === 'supervisor';

  // ── Submission form state ──────────────────────────────────────────────────
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [category,    setCategory]    = useState<Category>('general');
  const [priority,    setPriority]    = useState<Priority>('normal');
  const [submitting,  setSubmitting]  = useState(false);
  const [submitResult, setSubmitResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // ── Review list state ──────────────────────────────────────────────────────
  const [requests,       setRequests]       = useState<FeatureRequest[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [view,           setView]           = useState<'submit' | 'review'>('submit');
  const [statusFilter,   setStatusFilter]   = useState<Status | 'all'>('all');
  const [daysFilter,     setDaysFilter]     = useState('7');
  const [expandedId,     setExpandedId]     = useState<string | null>(null);
  const [editNotes,      setEditNotes]      = useState('');
  const [editStatus,     setEditStatus]     = useState<Status>('pending');
  const [savingId,       setSavingId]       = useState<string | null>(null);

  // ── Load requests ──────────────────────────────────────────────────────────
  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (daysFilter !== '0') params.set('since', `${daysFilter}d`);
      const res = await fetch(`/api/feedback?${params}`);
      if (res.ok) {
        const json = await res.json();
        setRequests(json.requests ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, daysFilter]);

  useEffect(() => {
    if (view === 'review') loadRequests();
  }, [view, statusFilter, daysFilter, loadRequests]);

  // ── Submit new request ─────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!title.trim()) return;
    setSubmitting(true);
    setSubmitResult(null);
    const res = await fetch('/api/feedback', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        title:        title.trim(),
        description:  description.trim() || undefined,
        category,
        priority,
        submittedBy:  operatorName,
        submittedById: user?.id,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      setTitle('');
      setDescription('');
      setCategory('general');
      setPriority('normal');
      setSubmitResult({ ok: true, msg: 'Request submitted! Thanks for the idea 💡' });
    } else {
      const json = await res.json();
      setSubmitResult({ ok: false, msg: json.error ?? 'Failed to submit' });
    }
  }

  // ── Save admin update ──────────────────────────────────────────────────────
  async function handleSaveUpdate(id: string) {
    setSavingId(id);
    const res = await fetch(`/api/feedback/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status: editStatus, adminNotes: editNotes }),
    });
    setSavingId(null);
    if (res.ok) {
      const json = await res.json();
      setRequests(prev => prev.map(r => r.id === id ? json.request : r));
      setExpandedId(null);
    }
  }

  // ── Weekly summary stats ──────────────────────────────────────────────────
  const thisWeek = requests.filter(r => {
    const d = new Date(r.created_at);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return d >= cutoff;
  });
  const countByStatus = (s: Status) => requests.filter(r => r.status === s).length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* Header */}
      <div className="shrink-0 px-6 pt-5 pb-4 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <h1 className="text-[12px] font-black tracking-widest text-white uppercase">Feature Requests</h1>
          <p className="text-[9px] text-slate-600 mt-0.5">Submit ideas · Track what's coming · Weekly review</p>
        </div>
        <div className="flex gap-1.5">
          {(['submit', ...(isAdmin ? ['review'] : [])] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v as 'submit' | 'review')}
              className={`px-4 py-2 rounded-lg text-[10px] font-bold tracking-wide transition-all ${
                view === v
                  ? 'bg-indigo-600/90 text-white'
                  : 'text-slate-500 hover:text-slate-300 border border-white/[0.08]'
              }`}
            >
              {v === 'submit' ? '+ Submit Idea' : '📋 Review All'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ── SUBMIT VIEW ───────────────────────────────────────────────────── */}
        {view === 'submit' && (
          <div className="max-w-lg mx-auto px-6 py-6 space-y-5">

            {/* Info banner */}
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3.5">
              <p className="text-[10px] text-indigo-300 leading-relaxed">
                Got an idea that would make your shift easier? Submit it here. Ideas are reviewed every week and the best ones get prioritized for the next build cycle.
              </p>
            </div>

            {/* Title */}
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                What's the idea? <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Show gate status on the alarm card"
                maxLength={120}
                className="w-full bg-[#0a0c10] border border-white/[0.12] rounded-lg px-3 py-2.5 text-[12px] text-white placeholder-slate-700 focus:outline-none focus:border-indigo-500/50"
              />
              <p className="text-[8px] text-slate-700 mt-0.5 text-right">{title.length}/120</p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Details (optional)
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe the problem you're trying to solve, or how you imagine this working…"
                rows={4}
                className="w-full bg-[#0a0c10] border border-white/[0.12] rounded-lg px-3 py-2 text-[11px] text-white placeholder-slate-700 focus:outline-none focus:border-indigo-500/50 resize-none"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-2">Category</label>
              <div className="grid grid-cols-4 gap-1.5">
                {CATEGORIES.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setCategory(c.value)}
                    className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-[9px] font-semibold transition-all ${
                      category === c.value
                        ? 'border-indigo-500/50 bg-indigo-500/10 text-white'
                        : 'border-white/[0.07] bg-white/[0.02] text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="text-[15px]">{c.icon}</span>
                    <span className="leading-tight text-center">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-2">Priority</label>
              <div className="flex gap-2">
                {PRIORITIES.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setPriority(p.value)}
                    className={`flex-1 py-2 rounded-lg border text-[9px] font-bold transition-all ${
                      priority === p.value
                        ? p.color
                        : 'border-white/[0.07] text-slate-600 hover:text-slate-400'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Result */}
            {submitResult && (
              <div className={`rounded-lg px-3 py-2.5 text-[10px] border ${
                submitResult.ok
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-red-500/10 border-red-500/30 text-red-300'
              }`}>
                {submitResult.msg}
              </div>
            )}

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={submitting || !title.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-[11px] font-bold text-white transition-all"
            >
              {submitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Submitting…
                </>
              ) : '💡 Submit Feature Request'}
            </button>

            {/* My recent submissions */}
            <RecentMine operatorName={operatorName} />
          </div>
        )}

        {/* ── REVIEW VIEW (admin/supervisor only) ───────────────────────────── */}
        {view === 'review' && isAdmin && (
          <div className="px-6 py-5 space-y-5">

            {/* Weekly summary strip */}
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: 'This Week',  value: thisWeek.length,          color: 'text-white'        },
                { label: 'Pending',    value: countByStatus('pending'),  color: 'text-slate-400'    },
                { label: 'In Review',  value: countByStatus('in_review'),color: 'text-amber-400'    },
                { label: 'Accepted',   value: countByStatus('accepted'), color: 'text-emerald-400'  },
                { label: 'Shipped',    value: countByStatus('shipped'),  color: 'text-indigo-400'   },
              ].map(stat => (
                <div key={stat.label} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-center">
                  <p className={`text-[20px] font-black ${stat.color}`}>{stat.value}</p>
                  <p className="text-[8px] text-slate-600 font-bold uppercase tracking-wider mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                <span className="text-[8px] text-slate-600 uppercase tracking-wider font-bold">Status:</span>
                {(['all', 'pending', 'in_review', 'accepted', 'shipped', 'declined'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-2.5 py-1 rounded text-[9px] font-bold transition-all ${
                      statusFilter === s
                        ? 'bg-indigo-600/80 text-white'
                        : 'text-slate-500 hover:text-slate-300 border border-white/[0.07]'
                    }`}
                  >
                    {s === 'all' ? 'All' : STATUSES.find(x => x.value === s)?.label ?? s}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 ml-auto">
                <span className="text-[8px] text-slate-600 uppercase tracking-wider font-bold">Period:</span>
                {DATE_FILTER_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setDaysFilter(opt.value)}
                    className={`px-2.5 py-1 rounded text-[9px] font-bold transition-all ${
                      daysFilter === opt.value
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-500 hover:text-slate-300 border border-white/[0.07]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                <button
                  onClick={loadRequests}
                  className="ml-1 text-[9px] text-indigo-400 hover:text-indigo-300 font-bold"
                >
                  ↻ Refresh
                </button>
              </div>
            </div>

            {/* Request list */}
            {loading ? (
              <div className="space-y-2">
                {[1,2,3,4].map(i => <div key={i} className="h-16 rounded-xl bg-white/[0.03] animate-pulse"/>)}
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-[32px] mb-3">🎉</p>
                <p className="text-[11px] text-slate-500">No requests match the current filters.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {requests.map(r => {
                  const isExpanded = expandedId === r.id;
                  return (
                    <div
                      key={r.id}
                      className={`rounded-xl border transition-all ${
                        isExpanded
                          ? 'border-indigo-500/30 bg-indigo-500/5'
                          : 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]'
                      }`}
                    >
                      {/* Row header */}
                      <button
                        className="w-full text-left px-4 py-3 flex items-center gap-3"
                        onClick={() => {
                          if (isExpanded) {
                            setExpandedId(null);
                          } else {
                            setExpandedId(r.id);
                            setEditStatus(r.status);
                            setEditNotes(r.admin_notes ?? '');
                          }
                        }}
                      >
                        <span className="text-[16px] shrink-0">{categoryIcon(r.category)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-white truncate">{r.title}</p>
                          <p className="text-[9px] text-slate-500 mt-0.5">
                            {r.submitted_by}
                            {' · '}
                            {new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[8px] font-bold px-2 py-0.5 rounded border ${priorityStyle(r.priority)}`}>
                            {r.priority.toUpperCase()}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${statusDot(r.status)}`}/>
                            <span className={`text-[9px] font-bold ${statusStyle(r.status)}`}>
                              {STATUSES.find(s => s.value === r.status)?.label ?? r.status}
                            </span>
                          </div>
                          <svg
                            className={`w-3.5 h-3.5 text-slate-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                          </svg>
                        </div>
                      </button>

                      {/* Expanded detail + admin controls */}
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-white/[0.07] pt-3 space-y-3">
                          {r.description && (
                            <p className="text-[10px] text-slate-300 leading-relaxed whitespace-pre-wrap">
                              {r.description}
                            </p>
                          )}
                          {r.admin_notes && !isExpanded && (
                            <p className="text-[9px] text-amber-400/80 italic">Admin: {r.admin_notes}</p>
                          )}

                          {/* Admin actions */}
                          <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-3 space-y-2.5">
                            <p className="text-[8px] font-bold uppercase tracking-wider text-slate-600">Admin Update</p>
                            {/* Status picker */}
                            <div className="flex gap-1.5 flex-wrap">
                              {STATUSES.map(s => (
                                <button
                                  key={s.value}
                                  onClick={() => setEditStatus(s.value)}
                                  className={`px-2.5 py-1 rounded text-[9px] font-bold border transition-all ${
                                    editStatus === s.value
                                      ? `${s.color} border-current bg-white/[0.05]`
                                      : 'text-slate-600 border-white/[0.07] hover:text-slate-400'
                                  }`}
                                >
                                  {s.label}
                                </button>
                              ))}
                            </div>
                            {/* Notes */}
                            <textarea
                              value={editNotes}
                              onChange={e => setEditNotes(e.target.value)}
                              placeholder="Admin notes (visible internally)…"
                              rows={2}
                              className="w-full bg-[#0a0c10] border border-white/[0.10] rounded-lg px-3 py-2 text-[10px] text-white placeholder-slate-700 focus:outline-none focus:border-indigo-500/40 resize-none"
                            />
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => setExpandedId(null)}
                                className="px-3 py-1.5 rounded text-[9px] text-slate-500 hover:text-slate-300 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveUpdate(r.id)}
                                disabled={savingId === r.id}
                                className="px-4 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 disabled:opacity-50 text-[9px] font-bold text-white transition-all"
                              >
                                {savingId === r.id ? 'Saving…' : 'Save Update'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-component: recent submissions by this operator ────────────────────────

function RecentMine({ operatorName }: { operatorName: string }) {
  const [mine, setMine] = useState<FeatureRequest[]>([]);

  useEffect(() => {
    fetch('/api/feedback?limit=50')
      .then(r => r.json())
      .then(json => {
        const all: FeatureRequest[] = json.requests ?? [];
        setMine(all.filter(r => r.submitted_by === operatorName).slice(0, 5));
      })
      .catch(() => {});
  }, [operatorName]);

  if (mine.length === 0) return null;

  return (
    <div className="border-t border-white/[0.06] pt-4">
      <p className="text-[8px] font-bold uppercase tracking-wider text-slate-600 mb-2">Your Recent Submissions</p>
      <div className="space-y-1.5">
        {mine.map(r => (
          <div key={r.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-white/[0.06] bg-white/[0.02]">
            <span className="text-[13px]">{categoryIcon(r.category)}</span>
            <p className="flex-1 text-[10px] text-slate-300 truncate">{r.title}</p>
            <div className="flex items-center gap-1 shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full ${statusDot(r.status)}`}/>
              <span className={`text-[8px] font-bold ${statusStyle(r.status)}`}>
                {STATUSES.find(s => s.value === r.status)?.label ?? r.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
