"use client";

// FILE: app/patrol/page.tsx
// GateGuard 5.0 — Virtual Patrol
// SOP: operators run patrols at 21:00 / 00:00 / 03:00 / 06:00 EST across all sites.
// Fixes: cameras loaded via zones (not direct account_id), multi-camera per site,
//        patrol time picker, clickable site nav during active patrol.

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';
import SmartVideoPlayer from '@/components/SmartVideoPlayer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Types ────────────────────────────────────────────────────────────────────
interface SiteCamera {
  id:            string;
  name:          string;
  een_camera_id: string;
  zone_id:       string;
}

interface Site {
  id:      string;   // accounts.id — used as accountId for SmartVideoPlayer
  name:    string;
  cameras: SiteCamera[];
}

interface SiteChecklist {
  gates_functional:        boolean;
  no_unauthorized_persons: boolean;
  common_areas_clear:      boolean;
  no_loitering:            boolean;
  no_dumping:              boolean;
}

interface SiteResult {
  account_id: string;
  site_name:  string;
  status:     'clear' | 'issue' | 'pending';
  checklist:  SiteChecklist;
  notes:      string;
  checked_at: string | null;
}

interface PatrolLog {
  id:            string;
  operator_name: string;
  started_at:    string;
  completed_at:  string | null;
  status:        string;
  patrol_type:   string;
  site_results:  SiteResult[];
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PATROL_SLOTS = [
  { time: '21:00', label: 'Start of Shift — 9 PM' },
  { time: '00:00', label: 'Midnight Check' },
  { time: '03:00', label: '3 AM Check' },
  { time: '06:00', label: 'End of Shift — 6 AM' },
];

const CHECKLIST_LABELS: Record<keyof SiteChecklist, string> = {
  gates_functional:        'Gates opening and closing normally',
  no_unauthorized_persons: 'No unauthorized persons at entry/exit points',
  common_areas_clear:      'Common areas clear (pool, mailroom, leasing office)',
  no_loitering:            'No loitering near dumpsters or main gate',
  no_dumping:              'No trash / dumping violations visible',
};

const EMPTY_CHECKLIST: SiteChecklist = {
  gates_functional:        false,
  no_unauthorized_persons: false,
  common_areas_clear:      false,
  no_loitering:            false,
  no_dumping:              false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

function nextPatrolInfo(): { slot: typeof PATROL_SLOTS[0]; minutesUntil: number } {
  const now     = new Date();
  const utcMin  = now.getUTCHours() * 60 + now.getUTCMinutes();
  const estMin  = ((utcMin - 5 * 60) % (24 * 60) + 24 * 60) % (24 * 60);

  for (const slot of PATROL_SLOTS) {
    const [h, m]    = slot.time.split(':').map(Number);
    const slotMin   = h * 60 + m;
    const diff      = ((slotMin - estMin) % (24 * 60) + 24 * 60) % (24 * 60);
    if (diff > 0) return { slot, minutesUntil: diff };
  }
  return { slot: PATROL_SLOTS[0], minutesUntil: 0 };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PatrolPage() {
  const { user }    = useUser();
  const operatorId  = user?.id ?? 'unknown';
  const operatorName = user?.fullName ?? user?.firstName ?? 'Operator';

  // ── Site / camera state ────────────────────────────────────────────────────
  const [sites, setSites]         = useState<Site[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tableError, setTableError] = useState(false);

  // Per-site active camera index
  const [camIdx, setCamIdx] = useState<Record<string, number>>({});

  // ── Patrol session state ───────────────────────────────────────────────────
  const [patrolActive, setPatrolActive]     = useState(false);
  const [startedAt, setStartedAt]           = useState<string | null>(null);
  const [currentSiteIdx, setCurrentSiteIdx] = useState(0);
  const [results, setResults]               = useState<SiteResult[]>([]);
  const [submitting, setSubmitting]         = useState(false);
  const [submitError, setSubmitError]       = useState<string | null>(null);
  const [patrolComplete, setPatrolComplete] = useState(false);

  // Patrol type picker (shown on idle screen before starting)
  const nextInfo = nextPatrolInfo();
  const [selectedSlot, setSelectedSlot] = useState<string>(nextInfo.slot.time);
  const patrolDue = nextInfo.minutesUntil <= 15;

  // ── History ────────────────────────────────────────────────────────────────
  const [history, setHistory]           = useState<PatrolLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── Load sites via accounts → zones → cameras ─────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data: accts, error } = await supabase
          .from('accounts')
          .select('id, name, zones(id, cameras(id, name, een_camera_id, zone_id))')
          .order('name');

        if (error) { setLoading(false); return; }

        const siteList: Site[] = (accts ?? []).map((a: any) => {
          const cameras: SiteCamera[] = (a.zones ?? [])
            .flatMap((z: any) => (z.cameras ?? []).filter((c: any) => c.een_camera_id))
            .map((c: any) => ({ id: c.id, name: c.name, een_camera_id: c.een_camera_id, zone_id: c.zone_id }));
          return { id: a.id, name: a.name, cameras };
        });

        setSites(siteList);
        // Default each site to camera 0
        const idx: Record<string, number> = {};
        siteList.forEach(s => { idx[s.id] = 0; });
        setCamIdx(idx);
      } finally {
        setLoading(false);
      }
    }
    load();
    loadHistory();
  }, []);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('patrol_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10);
      if (error?.message?.includes('does not exist')) {
        setTableError(true);
      } else {
        setHistory((data as PatrolLog[]) ?? []);
      }
    } finally {
      setHistoryLoading(false);
    }
  }

  // ── Start patrol ───────────────────────────────────────────────────────────
  function startPatrol() {
    const now = new Date().toISOString();
    setResults(sites.map(s => ({
      account_id: s.id,
      site_name:  s.name,
      status:     'pending',
      checklist:  { ...EMPTY_CHECKLIST },
      notes:      '',
      checked_at: null,
    })));
    setCurrentSiteIdx(0);
    setStartedAt(now);
    setPatrolActive(true);
    setPatrolComplete(false);
    setSubmitError(null);
  }

  // ── Checklist + notes ──────────────────────────────────────────────────────
  function toggleCheck(key: keyof SiteChecklist) {
    setResults(prev => prev.map((r, i) =>
      i !== currentSiteIdx ? r : { ...r, checklist: { ...r.checklist, [key]: !r.checklist[key] } }
    ));
  }

  function setNotes(val: string) {
    setResults(prev => prev.map((r, i) => i !== currentSiteIdx ? r : { ...r, notes: val }));
  }

  function markSite(status: 'clear' | 'issue') {
    const now = new Date().toISOString();
    setResults(prev => prev.map((r, i) =>
      i !== currentSiteIdx ? r : { ...r, status, checked_at: now }
    ));
    // Auto-advance to next unreviewed site
    const nextPending = results.findIndex((r, i) => i > currentSiteIdx && r.status === 'pending');
    if (nextPending !== -1) setCurrentSiteIdx(nextPending);
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function submitPatrol() {
    setSubmitting(true);
    setSubmitError(null);
    const completedAt = new Date().toISOString();
    const finalResults = results.map(r =>
      r.status === 'pending' ? { ...r, status: 'clear' as const, checked_at: completedAt } : r
    );
    try {
      const { error } = await supabase.from('patrol_logs').insert({
        operator_id:   operatorId,
        operator_name: operatorName,
        started_at:    startedAt,
        completed_at:  completedAt,
        site_results:  finalResults,
        status:        'completed',
        patrol_type:   selectedSlot,
      });
      if (error) {
        setSubmitError(error.message.includes('does not exist')
          ? 'patrol_logs table not yet created — run migration SQL below.'
          : error.message);
        if (error.message.includes('does not exist')) setTableError(true);
        setSubmitting(false);
        return;
      }
      setPatrolActive(false);
      setPatrolComplete(true);
      loadHistory();
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const currentSite   = sites[currentSiteIdx];
  const currentResult = results[currentSiteIdx];
  const activeCam     = currentSite ? currentSite.cameras[camIdx[currentSite.id] ?? 0] ?? null : null;
  const issueCount    = results.filter(r => r.status === 'issue').length;
  const allSitesDone  = results.length > 0 && results.every(r => r.status !== 'pending');

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full bg-[#030406] text-white overflow-hidden">

      {/* ── LEFT SIDEBAR ──────────────────────────────────────────────────── */}
      <aside className="w-[260px] shrink-0 flex flex-col border-r border-white/[0.06]">

        {/* Header */}
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <span className="text-[11px] font-semibold text-white uppercase tracking-[0.12em]">Virtual Patrol</span>
          </div>
          <p className="text-[9px] text-slate-500 mt-1">9PM – 6AM EST · {sites.length} Site{sites.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Schedule */}
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-2">Tonight's Schedule</p>
          <div className="space-y-1.5">
            {PATROL_SLOTS.map(({ time, label }) => {
              const isDue = patrolDue && time === nextInfo.slot.time;
              return (
                <div key={time} className={`flex items-center gap-2 px-2 py-1.5 rounded border transition-all ${
                  isDue ? 'bg-indigo-600/20 border-indigo-500/40' : 'border-white/[0.04] bg-white/[0.01]'
                }`}>
                  <span className={`text-[10px] font-mono font-bold ${isDue ? 'text-indigo-300' : 'text-slate-400'}`}>{time}</span>
                  <span className="text-[9px] text-slate-500 truncate">{label.split(' — ')[0]}</span>
                  {isDue && (
                    <span className="ml-auto flex items-center gap-1 text-[8px] text-indigo-400 font-semibold uppercase shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />Due
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {!patrolDue && (
            <p className="text-[9px] text-slate-600 mt-2 text-center">
              Next: {nextInfo.slot.time} EST
              {nextInfo.minutesUntil > 0 && ` — ${Math.floor(nextInfo.minutesUntil / 60)}h ${nextInfo.minutesUntil % 60}m`}
            </p>
          )}
        </div>

        {/* Site list — clickable during patrol to jump to any site */}
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-2">
            Sites ({sites.length})
          </p>
          {loading ? (
            <div className="flex justify-center py-3">
              <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-1">
              {sites.map((s, i) => {
                const res    = results[i];
                const active = patrolActive && i === currentSiteIdx;
                return (
                  <button
                    key={s.id}
                    onClick={() => patrolActive && setCurrentSiteIdx(i)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded border text-left text-[10px] transition-all ${
                      active
                        ? 'border-indigo-500/40 bg-indigo-600/10'
                        : patrolActive
                          ? 'border-white/[0.04] hover:border-indigo-500/20 hover:bg-white/[0.03] cursor-pointer'
                          : 'border-white/[0.04] cursor-default'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      !res                   ? 'bg-slate-700' :
                      res.status === 'clear' ? 'bg-emerald-500' :
                      res.status === 'issue' ? 'bg-red-500' :
                      active                 ? 'bg-indigo-400 animate-pulse' :
                                               'bg-slate-700'
                    }`} />
                    <span className={`truncate flex-1 ${active ? 'text-white font-semibold' : 'text-slate-400'}`}>
                      {s.name}
                    </span>
                    <span className="text-[8px] text-slate-600 shrink-0">{s.cameras.length}cam</span>
                    {res?.status === 'clear' && <span className="text-[8px] text-emerald-400">✓</span>}
                    {res?.status === 'issue' && <span className="text-[8px] text-red-400">!</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Patrol history */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-2">Recent Patrols</p>
          {historyLoading ? (
            <p className="text-[9px] text-slate-600 text-center py-2">Loading…</p>
          ) : history.length === 0 ? (
            <p className="text-[9px] text-slate-700 text-center py-3">No patrols logged yet</p>
          ) : (
            <div className="space-y-1.5">
              {history.map(h => {
                const issues = (h.site_results ?? []).filter((r: SiteResult) => r.status === 'issue').length;
                return (
                  <div key={h.id} className="px-2 py-1.5 rounded border border-white/[0.04] bg-white/[0.01]">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[9px] font-mono text-slate-400 truncate">{fmtDateTime(h.started_at)}</span>
                      {issues > 0
                        ? <span className="text-[8px] text-red-400 font-bold shrink-0">{issues} issue{issues > 1 ? 's' : ''}</span>
                        : <span className="text-[8px] text-emerald-400 font-bold shrink-0">All clear</span>
                      }
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-[9px] text-slate-600 truncate">{h.operator_name}</p>
                      {h.patrol_type && h.patrol_type !== 'scheduled' && (
                        <span className="text-[8px] font-mono text-slate-600 shrink-0">{h.patrol_type}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN PANEL ────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── IDLE / COMPLETE ──────────────────────────────────────────── */}
        {!patrolActive && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
            {patrolComplete ? (
              <>
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-[15px] font-bold text-white">Patrol Complete — {selectedSlot} EST</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {issueCount > 0
                      ? `${issueCount} issue${issueCount > 1 ? 's' : ''} found — raise alarms from Cameras page`
                      : 'All sites checked — no issues found'}
                  </p>
                </div>
                <button
                  onClick={startPatrol}
                  disabled={loading || sites.length === 0}
                  className="px-6 py-2.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-300 text-[11px] font-semibold uppercase tracking-wider transition-all"
                >
                  Start Another Patrol
                </button>
              </>
            ) : (
              <>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  patrolDue
                    ? 'bg-indigo-600/30 border-2 border-indigo-500/60 animate-pulse'
                    : 'bg-white/[0.04] border border-white/[0.08]'
                }`}>
                  <svg className={`w-8 h-8 ${patrolDue ? 'text-indigo-300' : 'text-slate-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>

                <div className="text-center">
                  <p className="text-[15px] font-bold text-white">
                    {patrolDue ? 'Patrol Due Now' : 'Virtual Patrol'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {sites.length} sites · 5 checklist items each · ~8 min
                  </p>
                </div>

                {/* Patrol type picker */}
                <div className="flex flex-col items-center gap-2">
                  <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-[0.1em]">Select Patrol</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PATROL_SLOTS.map(slot => (
                      <button
                        key={slot.time}
                        onClick={() => setSelectedSlot(slot.time)}
                        className={`px-4 py-2.5 rounded border text-left transition-all ${
                          selectedSlot === slot.time
                            ? 'border-indigo-500/60 bg-indigo-600/20 text-white'
                            : 'border-white/[0.08] bg-white/[0.02] text-slate-400 hover:border-white/20'
                        }`}
                      >
                        <p className="text-[11px] font-mono font-bold">{slot.time} EST</p>
                        <p className="text-[9px] text-slate-500 mt-0.5">{slot.label.split(' — ')[1] ?? slot.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={startPatrol}
                  disabled={loading || sites.length === 0}
                  className={`px-8 py-3 rounded-lg font-bold text-[12px] uppercase tracking-wider transition-all disabled:opacity-30 ${
                    patrolDue
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/40'
                      : 'bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-slate-300'
                  }`}
                >
                  {loading ? 'Loading sites…' : sites.length === 0 ? 'No sites configured' : `Start ${selectedSlot} Patrol`}
                </button>

                {tableError && (
                  <div className="mt-2 max-w-lg rounded border border-amber-500/30 bg-amber-500/10 p-4 text-left">
                    <p className="text-[10px] font-bold text-amber-300 mb-2">⚠ patrol_logs table not found — run in Supabase SQL Editor:</p>
                    <pre className="text-[9px] text-amber-200/80 font-mono whitespace-pre-wrap leading-relaxed">{`CREATE TABLE IF NOT EXISTS patrol_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id   TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL,
  completed_at  TIMESTAMPTZ,
  site_results  JSONB NOT NULL DEFAULT '[]',
  status        TEXT NOT NULL DEFAULT 'in_progress',
  patrol_type   TEXT NOT NULL DEFAULT 'scheduled',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);`}</pre>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── ACTIVE PATROL ─────────────────────────────────────────────── */}
        {patrolActive && currentSite && currentResult && (
          <>
            {/* Header bar */}
            <div className="px-5 py-2.5 border-b border-white/[0.06] flex items-center gap-4 bg-white/[0.01] shrink-0">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-[10px] font-mono text-slate-500 shrink-0">
                  {selectedSlot} · Site {currentSiteIdx + 1}/{sites.length}
                </span>
                <span className="text-[13px] font-bold text-indigo-300 truncate">{currentSite.name}</span>
              </div>
              {/* Progress dots */}
              <div className="flex items-center gap-1.5 shrink-0">
                {sites.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentSiteIdx(i)}
                    title={sites[i].name}
                    className={`rounded-full transition-all ${
                      results[i]?.status === 'clear'   ? 'w-2 h-2 bg-emerald-500' :
                      results[i]?.status === 'issue'   ? 'w-2 h-2 bg-red-500' :
                      i === currentSiteIdx             ? 'w-2.5 h-2.5 bg-indigo-400 ring-2 ring-indigo-400/30' :
                                                         'w-2 h-2 bg-slate-700 hover:bg-slate-500'
                    }`}
                  />
                ))}
              </div>
              {/* Progress bar */}
              <div className="w-24 h-1.5 rounded-full bg-white/[0.06] overflow-hidden shrink-0">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${(results.filter(r => r.status !== 'pending').length / Math.max(sites.length, 1)) * 100}%` }}
                />
              </div>
              <span className="text-[9px] text-slate-500 font-mono shrink-0">
                {startedAt ? fmtTime(startedAt) : ''}
              </span>
              {/* Submit early if all done */}
              {allSitesDone && (
                <button
                  onClick={submitPatrol}
                  disabled={submitting}
                  className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-40 shrink-0"
                >
                  {submitting ? 'Saving…' : 'Submit Report'}
                </button>
              )}
            </div>

            <div className="flex flex-1 min-h-0 overflow-hidden">

              {/* ── Camera feed + camera switcher ── */}
              <div className="flex-1 flex flex-col bg-black relative overflow-hidden">

                {/* Camera tabs */}
                {currentSite.cameras.length > 1 && (
                  <div className="flex gap-1 px-3 py-1.5 bg-black/60 border-b border-white/[0.06] shrink-0 overflow-x-auto">
                    {currentSite.cameras.map((cam, ci) => (
                      <button
                        key={cam.id}
                        onClick={() => setCamIdx(prev => ({ ...prev, [currentSite.id]: ci }))}
                        className={`px-2.5 py-1 rounded text-[9px] font-medium whitespace-nowrap transition-all shrink-0 ${
                          (camIdx[currentSite.id] ?? 0) === ci
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.1]'
                        }`}
                      >
                        {cam.name}
                      </button>
                    ))}
                  </div>
                )}

                {/* Video or no-camera state */}
                <div className="flex-1 relative overflow-hidden">
                  {activeCam ? (
                    <SmartVideoPlayer
                      accountId={currentSite.id}
                      cameraId={activeCam.een_camera_id}
                      source="een"
                      streamType="main"
                      label={currentSite.name}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                      <p className="text-[11px] text-slate-600">No cameras found for this site</p>
                      <p className="text-[9px] text-slate-700">Ensure cameras are configured in Setup → zone → cameras</p>
                    </div>
                  )}
                  {/* Site overlay */}
                  <div className="absolute top-3 left-3 bg-black/70 border border-white/10 rounded px-2 py-1 pointer-events-none">
                    <p className="text-[10px] font-bold text-white">{currentSite.name}</p>
                    {activeCam && <p className="text-[8px] text-slate-400">{activeCam.name}</p>}
                  </div>
                </div>
              </div>

              {/* ── Checklist panel ── */}
              <div className="w-[300px] shrink-0 border-l border-white/[0.06] flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">

                  {/* Checklist */}
                  <div>
                    <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-[0.1em] mb-2">Site Checklist</p>
                    <div className="space-y-1">
                      {(Object.keys(CHECKLIST_LABELS) as (keyof SiteChecklist)[]).map(key => (
                        <label
                          key={key}
                          onClick={() => toggleCheck(key)}
                          className={`flex items-start gap-2.5 px-2.5 py-2 rounded cursor-pointer transition-all border ${
                            currentResult.checklist[key]
                              ? 'border-emerald-500/30 bg-emerald-500/[0.06]'
                              : 'border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04]'
                          }`}
                        >
                          <div className={`shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-all ${
                            currentResult.checklist[key] ? 'bg-emerald-600 border-emerald-600' : 'border-white/20'
                          }`}>
                            {currentResult.checklist[key] && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="m4.5 12.75 6 6 9-13.5" />
                              </svg>
                            )}
                          </div>
                          <span className={`text-[10px] leading-snug ${
                            currentResult.checklist[key] ? 'text-emerald-400/80 line-through' : 'text-slate-300'
                          }`}>
                            {CHECKLIST_LABELS[key]}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-[0.1em] mb-1.5">Observations</p>
                    <textarea
                      value={currentResult.notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Gate issues, persons, vehicles, unusual activity…"
                      rows={4}
                      className="w-full bg-white/[0.02] border border-white/[0.06] rounded px-2.5 py-2 text-[10px] text-slate-300 placeholder-slate-600 resize-none focus:outline-none focus:border-indigo-500/50"
                    />
                  </div>

                  {submitError && (
                    <p className="text-[9px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5">✗ {submitError}</p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="p-3 border-t border-white/[0.06] space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => markSite('clear')}
                      className="py-2.5 rounded border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider transition-all"
                    >
                      ✓ All Clear
                    </button>
                    <button
                      onClick={() => markSite('issue')}
                      className="py-2.5 rounded border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-[10px] font-bold uppercase tracking-wider transition-all"
                    >
                      ! Issue Found
                    </button>
                  </div>

                  {allSitesDone && (
                    <button
                      onClick={submitPatrol}
                      disabled={submitting}
                      className="w-full py-2.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold uppercase tracking-wider transition-all disabled:opacity-40"
                    >
                      {submitting ? 'Saving…' : 'Submit Patrol Report'}
                    </button>
                  )}

                  {!allSitesDone && currentResult.status !== 'pending' && (
                    <p className="text-[9px] text-slate-600 text-center">
                      {results.filter(r => r.status === 'pending').length} site{results.filter(r => r.status === 'pending').length !== 1 ? 's' : ''} remaining — click any site in the sidebar
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
