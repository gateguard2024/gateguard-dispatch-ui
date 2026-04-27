"use client";

// FILE: app/patrol/page.tsx
// GateGuard 5.0 — Virtual Patrol
// SOP: operators run patrols at 21:00 / 00:00 / 03:00 / 06:00 EST across all sites.
// Each patrol logs: operator, start/end time, per-site checklist + notes + status.
// Saved to Supabase patrol_logs table. Gracefully handles missing table.

import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';
import SmartVideoPlayer from '@/components/SmartVideoPlayer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Types ──────────────────────��───────────────────��──────────────────────────
interface Site {
  id:              string;
  name:            string;
  primaryCameraId: string | null;
  primarySource:   string;
}

interface SiteChecklist {
  gates_functional:       boolean;
  no_unauthorized_persons:boolean;
  common_areas_clear:     boolean;
  no_loitering:           boolean;
  no_dumping:             boolean;
}

interface SiteResult {
  account_id:  string;
  site_name:   string;
  status:      'clear' | 'issue' | 'pending';
  checklist:   SiteChecklist;
  notes:       string;
  checked_at:  string | null;
}

interface PatrolLog {
  id:           string;
  operator_name:string;
  started_at:   string;
  completed_at: string | null;
  status:       string;
  site_results: SiteResult[];
}

// ─── SOP patrol schedule (EST hours) ──────────────────────────────────────────
const PATROL_HOURS = [21, 0, 3, 6];

const CHECKLIST_LABELS: Record<keyof SiteChecklist, string> = {
  gates_functional:        'Gates opening and closing normally',
  no_unauthorized_persons: 'No unauthorized persons at entry/exit points',
  common_areas_clear:      'Common areas clear (pool, mailroom, leasing office)',
  no_loitering:            'No loitering near dumpsters or main gate',
  no_dumping:              'No trash/dumping violations visible',
};

const EMPTY_CHECKLIST: SiteChecklist = {
  gates_functional:        false,
  no_unauthorized_persons: false,
  common_areas_clear:      false,
  no_loitering:            false,
  no_dumping:              false,
};

// ─── Helpers ─────────────────────────────��─────────────────────────────────────
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function nextPatrolTime(): { label: string; minutesUntil: number } {
  const now = new Date();
  const estOffset = -5 * 60; // EST = UTC-5
  const utcMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const estMin = ((utcMin + estOffset) % (24 * 60) + 24 * 60) % (24 * 60);
  const estHour = Math.floor(estMin / 60);
  const estMins = estMin % 60;

  for (const h of [...PATROL_HOURS].sort((a, b) => a - b)) {
    const patrolMin = h * 60;
    const adjustedPatrol = ((patrolMin - estMin) % (24 * 60) + 24 * 60) % (24 * 60);
    if (adjustedPatrol > 0) {
      const hrs = Math.floor(adjustedPatrol / 60);
      const mins = adjustedPatrol % 60;
      const label = `${String(h).padStart(2, '0')}:00`;
      return { label, minutesUntil: adjustedPatrol };
    }
  }
  return { label: '21:00', minutesUntil: 0 };
}

function isPatrolDue(): boolean {
  const { minutesUntil } = nextPatrolTime();
  // Due if within 15 minutes of a scheduled patrol
  return minutesUntil <= 15 || minutesUntil >= 24 * 60 - 15;
}

// ─── Main Component ────────────────────────────────────────────────────────���───
export default function PatrolPage() {
  const { user } = useUser();
  const operatorId   = user?.id ?? 'unknown';
  const operatorName = user?.fullName ?? user?.firstName ?? 'Operator';

  const [sites, setSites]         = useState<Site[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tableError, setTableError] = useState(false);

  // Patrol state
  const [patrolActive, setPatrolActive]   = useState(false);
  const [patrolId, setPatrolId]           = useState<string | null>(null);
  const [startedAt, setStartedAt]         = useState<string | null>(null);
  const [currentSiteIdx, setCurrentSiteIdx] = useState(0);
  const [results, setResults]             = useState<SiteResult[]>([]);
  const [submitting, setSubmitting]       = useState(false);
  const [submitError, setSubmitError]     = useState<string | null>(null);
  const [patrolComplete, setPatrolComplete] = useState(false);

  // History
  const [history, setHistory]     = useState<PatrolLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Next patrol countdown
  const [nextPatrol] = useState(() => nextPatrolTime());
  const patrolDue = isPatrolDue();

  // ── Load sites ────────────────��───────────────────���─────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Try with primary camera columns
        let { data: accts, error } = await supabase
          .from('accounts')
          .select('id, name, primary_camera_id, primary_camera_esn')
          .order('name');

        if (error) {
          // Fallback if migration 001m not applied
          const fallback = await supabase
            .from('accounts')
            .select('id, name')
            .order('name');
          accts = (fallback.data as typeof accts) ?? null;
        }

        if (!accts) { setLoading(false); return; }

        // For each account, get first EEN camera as fallback
        const siteList: Site[] = await Promise.all(accts.map(async (a: any) => {
          let camId = a.primary_camera_id ?? a.primary_camera_esn ?? null;
          let source = 'een';

          if (!camId) {
            const { data: cams } = await supabase
              .from('cameras')
              .select('een_camera_id, brivo_camera_id, source')
              .eq('account_id', a.id)
              .not('een_camera_id', 'is', null)
              .limit(1)
              .maybeSingle();
            camId  = cams?.een_camera_id ?? cams?.brivo_camera_id ?? null;
            source = cams?.source ?? 'een';
          }

          return { id: a.id, name: a.name, primaryCameraId: camId, primarySource: source };
        }));

        setSites(siteList);
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

  // ── Start patrol ──────────────────────────────────��─────────────────────────
  function startPatrol() {
    const now = new Date().toISOString();
    const initialResults: SiteResult[] = sites.map(s => ({
      account_id: s.id,
      site_name:  s.name,
      status:     'pending',
      checklist:  { ...EMPTY_CHECKLIST },
      notes:      '',
      checked_at: null,
    }));
    setResults(initialResults);
    setCurrentSiteIdx(0);
    setStartedAt(now);
    setPatrolActive(true);
    setPatrolComplete(false);
    setSubmitError(null);
  }

  // ── Update current site checklist ───────────────────────────────────────────
  function toggleCheck(key: keyof SiteChecklist) {
    setResults(prev => prev.map((r, i) =>
      i !== currentSiteIdx ? r : {
        ...r,
        checklist: { ...r.checklist, [key]: !r.checklist[key] },
      }
    ));
  }

  function setNotes(val: string) {
    setResults(prev => prev.map((r, i) =>
      i !== currentSiteIdx ? r : { ...r, notes: val }
    ));
  }

  function markSite(status: 'clear' | 'issue') {
    const now = new Date().toISOString();
    setResults(prev => prev.map((r, i) =>
      i !== currentSiteIdx ? r : { ...r, status, checked_at: now }
    ));
    if (currentSiteIdx < sites.length - 1) {
      setCurrentSiteIdx(i => i + 1);
    }
  }

  // ── Submit patrol ───────────────────────────────────────────────────────────
  async function submitPatrol() {
    setSubmitting(true);
    setSubmitError(null);
    const completedAt = new Date().toISOString();

    // Mark any still-pending sites as clear
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
        patrol_type:   'scheduled',
      });

      if (error) {
        if (error.message.includes('does not exist')) {
          setTableError(true);
          setSubmitError('patrol_logs table not yet created — run migration SQL below.');
        } else {
          setSubmitError(error.message);
        }
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
  const allChecked    = currentResult
    ? Object.values(currentResult.checklist).every(Boolean)
    : false;
  const issueCount    = results.filter(r => r.status === 'issue').length;

  // ─── RENDER ─────────────────���──────────────────────────��───────────────────
  return (
    <div className="flex h-full bg-[#030406] text-white overflow-hidden">

      {/* ── LEFT: Schedule + History ───────────��─────────────────────────── */}
      <aside className="w-[260px] shrink-0 flex flex-col border-r border-white/[0.06]">

        {/* Header */}
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <span className="text-[11px] font-semibold text-white uppercase tracking-[0.12em]">Virtual Patrol</span>
          </div>
          <p className="text-[9px] text-slate-500 mt-1">9PM – 6AM EST · 5 Sites</p>
        </div>

        {/* Schedule */}
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-2">Tonight's Schedule</p>
          <div className="space-y-1.5">
            {[
              { time: '21:00', label: 'Start of Shift' },
              { time: '00:00', label: 'Midnight' },
              { time: '03:00', label: 'Mid-Night' },
              { time: '06:00', label: 'End of Shift' },
            ].map(({ time, label }) => {
              const isDue = patrolDue && time === nextPatrol.label;
              return (
                <div key={time} className={`flex items-center gap-2 px-2 py-1.5 rounded border transition-all ${
                  isDue
                    ? 'bg-indigo-600/20 border-indigo-500/40'
                    : 'border-white/[0.04] bg-white/[0.01]'
                }`}>
                  <span className={`text-[10px] font-mono font-bold ${isDue ? 'text-indigo-300' : 'text-slate-400'}`}>{time}</span>
                  <span className="text-[9px] text-slate-500">{label}</span>
                  {isDue && (
                    <span className="ml-auto flex items-center gap-1 text-[8px] text-indigo-400 font-semibold uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                      Due
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {!patrolDue && (
            <p className="text-[9px] text-slate-600 mt-2 text-center">
              Next patrol: {nextPatrol.label} EST
              {nextPatrol.minutesUntil > 0 && ` (${Math.floor(nextPatrol.minutesUntil / 60)}h ${nextPatrol.minutesUntil % 60}m)`}
            </p>
          )}
        </div>

        {/* Site list */}
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
                const res = results[i];
                return (
                  <div key={s.id} className={`flex items-center gap-2 px-2 py-1.5 rounded border text-[10px] transition-all ${
                    patrolActive && i === currentSiteIdx
                      ? 'border-indigo-500/40 bg-indigo-600/10'
                      : 'border-white/[0.04]'
                  }`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      !res              ? 'bg-slate-700' :
                      res.status === 'clear' ? 'bg-emerald-500' :
                      res.status === 'issue' ? 'bg-red-500' :
                      patrolActive && i === currentSiteIdx ? 'bg-indigo-400 animate-pulse' :
                      'bg-slate-700'
                    }`} />
                    <span className={`truncate ${patrolActive && i === currentSiteIdx ? 'text-white font-semibold' : 'text-slate-400'}`}>
                      {s.name}
                    </span>
                    {res?.status === 'clear' && <span className="ml-auto text-[8px] text-emerald-400">✓</span>}
                    {res?.status === 'issue' && <span className="ml-auto text-[8px] text-red-400">!</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent patrol history */}
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
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono text-slate-400">{fmtDateTime(h.started_at)}</span>
                      {issues > 0
                        ? <span className="text-[8px] text-red-400 font-bold">{issues} issue{issues > 1 ? 's' : ''}</span>
                        : <span className="text-[8px] text-emerald-400 font-bold">All clear</span>
                      }
                    </div>
                    <p className="text-[9px] text-slate-600 mt-0.5">{h.operator_name}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN: Active patrol or idle state ───────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── IDLE / COMPLETE STATE ───────────────��─────────────────────── */}
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
                  <p className="text-[15px] font-bold text-white">Patrol Complete</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {issueCount > 0
                      ? `${issueCount} issue${issueCount > 1 ? 's' : ''} logged — check Reports for details`
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
                    {patrolDue
                      ? `Scheduled patrol at ${nextPatrol.label} EST — start when ready`
                      : `Next patrol at ${nextPatrol.label} EST`}
                  </p>
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    {sites.length} sites · 5 checklist items each · ~5 min
                  </p>
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
                  {loading ? 'Loading sites…' : 'Start Patrol'}
                </button>

                {/* Migration notice */}
                {tableError && (
                  <div className="mt-4 max-w-lg rounded border border-amber-500/30 bg-amber-500/10 p-4 text-left">
                    <p className="text-[10px] font-bold text-amber-300 mb-2">⚠ patrol_logs table not found — run this migration in Supabase SQL Editor:</p>
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

        {/* ── ACTIVE PATROL ─────────────��───────────────────────────────── */}
        {patrolActive && currentSite && currentResult && (
          <>
            {/* Progress bar + header */}
            <div className="px-6 py-3 border-b border-white/[0.06] flex items-center gap-4 bg-white/[0.01] shrink-0">
              <div className="flex items-center gap-3 flex-1">
                <span className="text-[11px] font-bold text-white">
                  Site {currentSiteIdx + 1} of {sites.length}
                </span>
                <span className="text-[13px] font-bold text-indigo-300">{currentSite.name}</span>
              </div>
              {/* Progress dots */}
              <div className="flex items-center gap-1.5">
                {sites.map((_, i) => (
                  <div key={i} className={`rounded-full transition-all ${
                    i < currentSiteIdx      ? 'w-2 h-2 bg-emerald-500' :
                    i === currentSiteIdx    ? 'w-2.5 h-2.5 bg-indigo-400 ring-2 ring-indigo-400/30' :
                    results[i]?.status === 'issue' ? 'w-2 h-2 bg-red-500' :
                    'w-2 h-2 bg-slate-700'
                  }`} />
                ))}
              </div>
              {/* Progress bar */}
              <div className="w-32 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${((currentSiteIdx) / sites.length) * 100}%` }}
                />
              </div>
              <span className="text-[9px] text-slate-500 font-mono shrink-0">
                Started {startedAt ? fmtTime(startedAt) : ''}
              </span>
            </div>

            <div className="flex flex-1 min-h-0 overflow-hidden">

              {/* Camera feed */}
              <div className="flex-1 bg-black relative overflow-hidden">
                {currentSite.primaryCameraId ? (
                  <SmartVideoPlayer
                    accountId={currentSite.id}
                    cameraId={currentSite.primaryCameraId}
                    source={currentSite.primarySource as 'een' | 'brivo'}
                    streamType="main"
                    label={currentSite.name}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                    <p className="text-[11px] text-slate-600">No camera configured for this site</p>
                    <p className="text-[9px] text-slate-700">Set a primary camera in the Cameras page</p>
                  </div>
                )}
                {/* Site label */}
                <div className="absolute top-3 left-3 bg-black/70 border border-white/10 rounded px-2 py-1 pointer-events-none">
                  <p className="text-[10px] font-bold text-white">{currentSite.name}</p>
                  <p className="text-[8px] text-slate-400">Patrol check — {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })} EST</p>
                </div>
              </div>

              {/* Checklist panel */}
              <div className="w-[320px] shrink-0 border-l border-white/[0.06] flex flex-col overflow-hidden">

                <div className="flex-1 overflow-y-auto p-4 space-y-4">

                  {/* Checklist */}
                  <div>
                    <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-[0.1em] mb-2">
                      Site Checklist
                    </p>
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
                            currentResult.checklist[key]
                              ? 'bg-emerald-600 border-emerald-600'
                              : 'border-white/20 bg-transparent'
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
                    <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-[0.1em] mb-1.5">
                      Observations / Notes
                    </p>
                    <textarea
                      value={currentResult.notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Note anything you see — gate issues, persons, vehicles, unusual activity…"
                      rows={4}
                      className="w-full bg-white/[0.02] border border-white/[0.06] rounded px-2.5 py-2 text-[10px] text-slate-300 placeholder-slate-600 resize-none focus:outline-none focus:border-indigo-500/50"
                    />
                  </div>

                  {submitError && (
                    <p className="text-[9px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5">
                      ✗ {submitError}
                    </p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="p-4 border-t border-white/[0.06] space-y-2">
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

                  {/* Last site — show Submit patrol button */}
                  {currentSiteIdx === sites.length - 1 && currentResult.status !== 'pending' && (
                    <button
                      onClick={submitPatrol}
                      disabled={submitting}
                      className="w-full py-2.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold uppercase tracking-wider transition-all disabled:opacity-40"
                    >
                      {submitting ? 'Saving…' : 'Submit Patrol Report'}
                    </button>
                  )}

                  {/* Skip to submit early */}
                  {currentSiteIdx < sites.length - 1 && currentResult.status !== 'pending' && (
                    <p className="text-[9px] text-slate-600 text-center">
                      Next site loads automatically after marking →
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
