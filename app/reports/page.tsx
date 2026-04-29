"use client";

// FILE: app/reports/page.tsx
// GateGuard 5.0 — Incident Reports
// Lists all resolved incidents written by the alarms page.
// Columns: date/time · site · priority · event · action · operator · notes preview
// Click any row to expand the full report body.

import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Types ────────────────────────────────────────────────────────────────────
type Priority = 'P1' | 'P2' | 'P3' | 'P4';
type DateRange = 'today' | '7d' | '30d' | 'all';
type ReportTab = 'incidents' | 'patrol-issues' | 'gates' | 'comms';

interface CommsEntry {
  id:            string;
  type:          'call' | 'email';
  contact:       string;   // to_number or to_email
  site_name:     string;
  operator_name: string;
  detail:        string;   // template name or call status
  created_at:    string;
}

interface GateRecord {
  id:                 string;
  account_id:         string;
  zone_id:            string | null;
  name:               string;
  gate_type:          string;
  brivo_door_id:      string | null;
  has_control:        boolean;
  status:             'operational' | 'needs_service' | 'unknown';
  status_notes:       string | null;
  status_updated_at:  string | null;
  status_updated_by:  string | null;
  // joined
  site_name?:         string;
}

interface PatrolIssue {
  patrol_id:     string;
  patrolled_at:  string;
  operator_name: string;
  account_id:    string;
  site_name:     string;
  issue_detail:  string;
  notes:         string;
  acknowledged:  boolean;
}

interface IncidentReport {
  id:            string;
  alarm_id:      string | null;
  zone_id:       string | null;
  camera_id:     string | null;
  operator_id:   string | null;
  operator_name: string | null;
  action_taken:  string | null;
  notes:         string | null;
  report_type:   string | null;
  report_body:   string | null;
  generated_at:  string;
  alarms?: {
    priority:    Priority;
    event_label: string;
    site_name:   string;
    created_at:  string;
    cameras?: { name: string } | null;
  } | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const PRIORITY_CONFIG: Record<Priority, { color: string; bg: string; dot: string }> = {
  P1: { color: 'text-red-400',     bg: 'bg-red-500/10',     dot: 'bg-red-500' },
  P2: { color: 'text-orange-400',  bg: 'bg-orange-500/10',  dot: 'bg-orange-500' },
  P3: { color: 'text-yellow-400',  bg: 'bg-yellow-500/10',  dot: 'bg-yellow-500' },
  P4: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', dot: 'bg-emerald-500' },
};

const ACTION_LABELS: Record<string, string> = {
  authorized:        'Access Authorized',
  unauthorized:      'Unauthorized Activity',
  false_alarm:       'False Alarm',
  police_dispatched: 'Police Dispatched',
  other:             'Other',
};

const ACTION_COLORS: Record<string, string> = {
  authorized:        'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  unauthorized:      'bg-red-500/15 text-red-300 border-red-500/30',
  false_alarm:       'bg-sky-500/15 text-sky-300 border-sky-500/30',
  police_dispatched: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  other:             'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d',    label: 'Last 7 days' },
  { value: '30d',   label: 'Last 30 days' },
  { value: 'all',   label: 'All time' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function rangeStart(range: DateRange): string | null {
  if (range === 'all') return null;
  const now = new Date();
  if (range === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }
  const days = range === '7d' ? 7 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ReportsPage() {
  const { user }       = useUser();
  const operatorName   = user?.fullName ?? user?.firstName ?? 'Operator';
  const [activeTab, setActiveTab]     = useState<ReportTab>('incidents');
  const [reports, setReports]         = useState<IncidentReport[]>([]);
  const [loading, setLoading]         = useState(true);
  const [dateRange, setDateRange]     = useState<DateRange>('30d');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [search, setSearch]           = useState('');
  const [selectedReport, setSelectedReport] = useState<IncidentReport | null>(null);
  const [copied, setCopied]           = useState(false);
  const [totalCount, setTotalCount]   = useState(0);

  // ── Patrol Issues state ────────────────────────────────────────────────────
  const [patrolIssues, setPatrolIssues]         = useState<PatrolIssue[]>([]);
  const [patrolIssuesLoading, setPatrolIssuesLoading] = useState(false);
  const [ackingKey, setAckingKey]               = useState<string | null>(null);

  // ── Gates state ────────────────────────────────────────────────────────────
  const [gates,         setGates]         = useState<GateRecord[]>([]);
  const [gatesLoading,  setGatesLoading]  = useState(false);
  const [togglingGate,  setTogglingGate]  = useState<string | null>(null);
  const [gateSearch,    setGateSearch]    = useState('');

  // ── Comms state ────────────────────────────────────────────────────────────
  const [commsEntries,   setCommsEntries]   = useState<CommsEntry[]>([]);
  const [commsLoading,   setCommsLoading]   = useState(false);
  const [commsRange,     setCommsRange]     = useState<DateRange>('7d');
  const [commsTypeFilter, setCommsTypeFilter] = useState<'all' | 'call' | 'email'>('all');
  const [commsSiteSearch, setCommsSiteSearch] = useState('');

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('incident_reports')
        .select(`
          *,
          alarms ( priority, event_label, site_name, created_at, cameras( name ) )
        `, { count: 'exact' })
        .order('generated_at', { ascending: false })
        .limit(200);

      const start = rangeStart(dateRange);
      if (start) q = q.gte('generated_at', start);
      if (actionFilter !== 'all') q = q.eq('action_taken', actionFilter);

      const { data, count } = await q;
      setReports((data as IncidentReport[]) ?? []);
      setTotalCount(count ?? 0);
    } finally {
      setLoading(false);
    }
  }, [dateRange, actionFilter]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  // ── Fetch patrol issues ────────────────────────────────────────────────────
  const fetchPatrolIssues = useCallback(async () => {
    setPatrolIssuesLoading(true);
    try {
      const cutoff = rangeStart('30d');
      let q = supabase
        .from('patrol_logs')
        .select('id, operator_name, completed_at, site_results')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(100);
      if (cutoff) q = q.gte('completed_at', cutoff);
      const { data } = await q;
      const issues: PatrolIssue[] = [];
      for (const log of (data ?? [])) {
        for (const r of (log.site_results ?? [])) {
          if (r.status === 'issue') {
            issues.push({
              patrol_id:    log.id,
              patrolled_at: log.completed_at ?? '',
              operator_name: log.operator_name ?? 'Unknown',
              account_id:   r.account_id,
              site_name:    r.site_name ?? r.account_id,
              issue_detail: r.issue_detail ?? '',
              notes:        r.notes ?? '',
              acknowledged: r.acknowledged === true,
            });
          }
        }
      }
      setPatrolIssues(issues);
    } finally {
      setPatrolIssuesLoading(false);
    }
  }, []);

  useEffect(() => { fetchPatrolIssues(); }, [fetchPatrolIssues]);

  // ── Acknowledge a patrol issue ─────────────────────────────────────────────
  async function acknowledgeIssue(issue: PatrolIssue) {
    const key = issue.patrol_id + issue.account_id;
    setAckingKey(key);
    try {
      // Fetch latest site_results for this log, set acknowledged=true for this site
      const { data: log } = await supabase
        .from('patrol_logs')
        .select('site_results')
        .eq('id', issue.patrol_id)
        .single();
      const updated = (log?.site_results ?? []).map((r: any) =>
        r.account_id === issue.account_id && r.status === 'issue'
          ? { ...r, acknowledged: true }
          : r
      );
      await supabase
        .from('patrol_logs')
        .update({ site_results: updated })
        .eq('id', issue.patrol_id);
      setPatrolIssues(prev => prev.map(i =>
        i.patrol_id === issue.patrol_id && i.account_id === issue.account_id
          ? { ...i, acknowledged: true }
          : i
      ));
    } finally {
      setAckingKey(null);
    }
  }

  // ── Gates fetch + toggle ──────────────────────────────────────────────────
  const fetchGates = useCallback(async () => {
    setGatesLoading(true);
    try {
      // Two-step: fetch gates + accounts separately to avoid FK join dependency
      const [{ data: gateRows, error: gateErr }, { data: accountRows }] = await Promise.all([
        supabase.from('gates').select('*').order('status').order('name'),
        supabase.from('accounts').select('id, name').order('name'),
      ]);
      if (gateErr) console.error('fetchGates error:', gateErr);
      const accountMap: Record<string, string> = Object.fromEntries(
        (accountRows ?? []).map((a: any) => [a.id, a.name])
      );
      const mapped: GateRecord[] = (gateRows ?? []).map((g: any) => ({
        ...g,
        site_name: accountMap[g.account_id] ?? g.account_id,
      }));
      setGates(mapped);
    } finally {
      setGatesLoading(false);
    }
  }, []);

  useEffect(() => { fetchGates(); }, [fetchGates]);

  async function toggleGateStatus(gate: GateRecord, operatorName: string) {
    const nextStatus = gate.status === 'operational' ? 'needs_service' : 'operational';
    setTogglingGate(gate.id);
    try {
      await supabase.from('gates').update({
        status:           nextStatus,
        status_updated_at: new Date().toISOString(),
        status_updated_by: operatorName,
      }).eq('id', gate.id);
      setGates(prev => prev.map(g =>
        g.id === gate.id
          ? { ...g, status: nextStatus, status_updated_at: new Date().toISOString(), status_updated_by: operatorName }
          : g
      ));
    } finally {
      setTogglingGate(null);
    }
  }

  // ── Comms fetch ────────────────────────────────────────────────────────────
  const fetchComms = useCallback(async () => {
    setCommsLoading(true);
    try {
      const start = rangeStart(commsRange);
      const [callsRes, emailsRes] = await Promise.all([
        supabase.from('calls')
          .select('id, to_number, site_name, operator_name, status, created_at')
          .order('created_at', { ascending: false })
          .limit(100)
          .then(r => { return start ? supabase.from('calls').select('id, to_number, site_name, operator_name, status, created_at').gte('created_at', start).order('created_at', { ascending: false }).limit(100) : r; }),
        supabase.from('emails_sent')
          .select('id, to_email, template, site_name, operator_name, subject, created_at')
          .order('created_at', { ascending: false })
          .limit(100)
          .then(r => { return start ? supabase.from('emails_sent').select('id, to_email, template, site_name, operator_name, subject, created_at').gte('created_at', start).order('created_at', { ascending: false }).limit(100) : r; }),
      ]);
      const calls: CommsEntry[] = (callsRes.data ?? []).map((c: any) => ({
        id:            `call-${c.id}`,
        type:          'call',
        contact:       c.to_number,
        site_name:     c.site_name ?? '',
        operator_name: c.operator_name ?? '',
        detail:        c.status ?? 'initiated',
        created_at:    c.created_at,
      }));
      const emails: CommsEntry[] = (emailsRes.data ?? []).map((e: any) => ({
        id:            `email-${e.id}`,
        type:          'email',
        contact:       e.to_email,
        site_name:     e.site_name ?? '',
        operator_name: e.operator_name ?? '',
        detail:        e.template ? e.template.replace(/_/g, ' ') : (e.subject ?? ''),
        created_at:    e.created_at,
      }));
      const merged = [...calls, ...emails].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setCommsEntries(merged);
    } finally {
      setCommsLoading(false);
    }
  }, [commsRange]);

  useEffect(() => { if (activeTab === 'comms') fetchComms(); }, [activeTab, fetchComms]);

  // Client-side text search
  const filtered = reports.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.alarms?.site_name?.toLowerCase().includes(s) ||
      r.alarms?.event_label?.toLowerCase().includes(s) ||
      r.operator_name?.toLowerCase().includes(s) ||
      r.notes?.toLowerCase().includes(s) ||
      r.action_taken?.toLowerCase().includes(s)
    );
  });

  function copyReport() {
    if (!selectedReport?.report_body) return;
    navigator.clipboard.writeText(selectedReport.report_body).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#030406] text-white overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-[15px] font-black tracking-tight text-white uppercase">Reports</h1>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {activeTab === 'incidents'
                ? (loading ? 'Loading…' : `${totalCount} report${totalCount !== 1 ? 's' : ''} · showing ${filtered.length}`)
                : activeTab === 'patrol-issues'
                ? (patrolIssuesLoading ? 'Loading…' : `${patrolIssues.filter(i => !i.acknowledged).length} open patrol issue${patrolIssues.filter(i => !i.acknowledged).length !== 1 ? 's' : ''}`)
                : activeTab === 'comms'
                ? (commsLoading ? 'Loading…' : `${commsEntries.filter(e => commsTypeFilter === 'all' || e.type === commsTypeFilter).length} entries`)
                : (gatesLoading ? 'Loading…' : `${gates.filter(g => g.status === 'needs_service').length} gate${gates.filter(g => g.status === 'needs_service').length !== 1 ? 's' : ''} need service · ${gates.length} total`)}
            </p>
          </div>
          {/* Tab switcher */}
          <div className="flex items-center gap-0.5 bg-white/[0.04] border border-white/[0.06] rounded-md p-0.5">
            <button
              onClick={() => setActiveTab('incidents')}
              className={`px-3 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${activeTab === 'incidents' ? 'bg-indigo-600/60 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Incidents
            </button>
            <button
              onClick={() => setActiveTab('patrol-issues')}
              className={`px-3 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeTab === 'patrol-issues' ? 'bg-indigo-600/60 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Patrol Issues
              {patrolIssues.filter(i => !i.acknowledged).length > 0 && (
                <span className="bg-amber-500 text-black text-[8px] font-black rounded-full px-1.5 py-0.5 leading-none">
                  {patrolIssues.filter(i => !i.acknowledged).length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('gates')}
              className={`px-3 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeTab === 'gates' ? 'bg-indigo-600/60 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Gates
              {gates.filter(g => g.status === 'needs_service').length > 0 && (
                <span className="bg-red-500 text-white text-[8px] font-black rounded-full px-1.5 py-0.5 leading-none">
                  {gates.filter(g => g.status === 'needs_service').length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('comms')}
              className={`px-3 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${activeTab === 'comms' ? 'bg-indigo-600/60 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Comms Log
            </button>
          </div>
        </div>

        {/* Filters row — incidents only */}
        {activeTab === 'incidents' && <div className="flex items-center gap-2 flex-wrap">
          {/* Date range */}
          <div className="flex items-center gap-0.5 bg-white/[0.04] border border-white/[0.06] rounded-md p-0.5">
            {DATE_RANGE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setDateRange(opt.value)}
                className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${
                  dateRange === opt.value
                    ? 'bg-indigo-600/60 text-white'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Action filter */}
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="bg-white/[0.04] border border-white/[0.06] rounded-md px-2.5 py-1.5 text-[10px] text-slate-300 focus:outline-none focus:border-indigo-500/50"
          >
            <option value="all">All actions</option>
            {Object.entries(ACTION_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search site, event, notes…"
            className="bg-white/[0.04] border border-white/[0.06] rounded-md px-2.5 py-1.5 text-[10px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 w-52"
          />

          {/* Refresh */}
          <button
            onClick={fetchReports}
            disabled={loading}
            className="px-2.5 py-1.5 rounded-md border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] text-[10px] text-slate-400 hover:text-white transition-all disabled:opacity-40"
            title="Refresh"
          >
            ↺
          </button>
        </div>}
      </div>

      {/* ── Patrol Issues Tab ─────────────────────────────────────────────── */}
      {activeTab === 'patrol-issues' && (
        <div className="flex-1 overflow-y-auto p-6">
          {patrolIssuesLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-[10px] text-slate-600 uppercase tracking-wider">Loading patrol issues…</p>
            </div>
          ) : patrolIssues.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2 text-center">
              <p className="text-[13px] text-slate-600">No patrol issues in the last 30 days</p>
              <p className="text-[10px] text-slate-700">Issues flagged during patrol will appear here for follow-up.</p>
            </div>
          ) : (
            <div className="space-y-3 max-w-3xl">
              {/* Open issues first, then acknowledged */}
              {[...patrolIssues].sort((a, b) => Number(a.acknowledged) - Number(b.acknowledged)).map((issue, idx) => (
                <div
                  key={issue.patrol_id + issue.account_id + idx}
                  className={`rounded-lg border p-4 transition-all ${
                    issue.acknowledged
                      ? 'border-white/[0.05] bg-white/[0.01] opacity-50'
                      : 'border-amber-500/20 bg-amber-500/[0.04]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {!issue.acknowledged && (
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                        )}
                        <p className="text-[12px] font-bold text-white truncate">{issue.site_name}</p>
                        <span className={`px-1.5 py-0.5 rounded border text-[8px] font-semibold uppercase ${
                          issue.acknowledged
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                            : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                        }`}>
                          {issue.acknowledged ? 'Acknowledged' : 'Open'}
                        </span>
                      </div>
                      {issue.issue_detail && (
                        <p className="text-[11px] text-slate-300 leading-relaxed mb-1.5">{issue.issue_detail}</p>
                      )}
                      {issue.notes && (
                        <p className="text-[10px] text-slate-500 italic">"{issue.notes}"</p>
                      )}
                      <p className="text-[9px] text-slate-600 mt-1.5">
                        {fmtDateTime(issue.patrolled_at)} · {issue.operator_name}
                      </p>
                    </div>
                    {!issue.acknowledged && (
                      <button
                        onClick={() => acknowledgeIssue(issue)}
                        disabled={ackingKey === issue.patrol_id + issue.account_id}
                        className="shrink-0 px-3 py-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-[9px] font-semibold uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {ackingKey === issue.patrol_id + issue.account_id ? '…' : '✓ Acknowledge'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Gates Tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'gates' && (
        <div className="flex-1 overflow-y-auto p-6">
          {/* Search + refresh */}
          <div className="flex items-center gap-3 mb-5 max-w-3xl">
            <input
              type="text"
              value={gateSearch}
              onChange={e => setGateSearch(e.target.value)}
              placeholder="Search gates or sites…"
              className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-md px-2.5 py-1.5 text-[10px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
            />
            <button
              onClick={fetchGates}
              disabled={gatesLoading}
              className="px-2.5 py-1.5 rounded-md border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] text-[10px] text-slate-400 hover:text-white transition-all disabled:opacity-40"
            >↺</button>
          </div>

          {gatesLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-[10px] text-slate-600 uppercase tracking-wider">Loading gates…</p>
            </div>
          ) : gates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2 text-center">
              <p className="text-[13px] text-slate-600">No gates configured</p>
              <p className="text-[10px] text-slate-700">Add gates in Setup → select a site → Gates tab.</p>
            </div>
          ) : (() => {
            const filtered = gates.filter(g => {
              if (!gateSearch) return true;
              const s = gateSearch.toLowerCase();
              return g.name.toLowerCase().includes(s) || (g.site_name ?? '').toLowerCase().includes(s);
            });
            // Group by site
            const bySite: Record<string, GateRecord[]> = {};
            for (const g of filtered) {
              const k = g.site_name ?? g.account_id;
              if (!bySite[k]) bySite[k] = [];
              bySite[k].push(g);
            }
            return (
              <div className="space-y-6 max-w-3xl">
                {Object.entries(bySite).sort(([a],[b]) => a.localeCompare(b)).map(([siteName, siteGates]) => (
                  <div key={siteName}>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-2">{siteName}</p>
                    <div className="border border-white/[0.06] rounded-lg overflow-hidden">
                      {siteGates.map((gate, idx) => (
                        <div
                          key={gate.id}
                          className={`flex items-center gap-4 px-4 py-3 ${idx < siteGates.length - 1 ? 'border-b border-white/[0.04]' : ''} ${gate.status === 'needs_service' ? 'bg-amber-500/[0.03]' : ''}`}
                        >
                          {/* Gate type icon */}
                          <span className="text-[18px] shrink-0">
                            {gate.gate_type === 'vehicle' ? '🚗' : gate.gate_type === 'pedestrian' ? '🚶' : '🚧'}
                          </span>

                          {/* Name + meta */}
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-white truncate">{gate.name}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[9px] text-slate-600 capitalize">{gate.gate_type}</span>
                              {gate.has_control && (
                                <span className="text-[8px] px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-semibold uppercase">Brivo Control</span>
                              )}
                              {gate.status_updated_by && (
                                <span className="text-[9px] text-slate-700">
                                  Updated by {gate.status_updated_by}
                                  {gate.status_updated_at ? ` · ${fmtDateTime(gate.status_updated_at)}` : ''}
                                </span>
                              )}
                            </div>
                            {gate.status_notes && (
                              <p className="text-[9px] text-amber-400/70 mt-0.5 italic">{gate.status_notes}</p>
                            )}
                          </div>

                          {/* Status badge */}
                          <span className={`shrink-0 text-[9px] font-bold px-2.5 py-1 rounded border uppercase tracking-wider ${
                            gate.status === 'operational'   ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' :
                            gate.status === 'needs_service' ? 'border-amber-500/40 bg-amber-500/15 text-amber-400' :
                                                              'border-slate-600/30 bg-slate-600/10 text-slate-500'
                          }`}>
                            {gate.status === 'operational' ? '✓ Operational' : gate.status === 'needs_service' ? '⚠ Needs Service' : 'Unknown'}
                          </span>

                          {/* Toggle button */}
                          <button
                            onClick={() => toggleGateStatus(gate, operatorName)}
                            disabled={togglingGate === gate.id}
                            className={`shrink-0 px-3 py-1.5 rounded border text-[9px] font-semibold uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                              gate.status === 'operational'
                                ? 'border-amber-500/30 bg-transparent hover:bg-amber-500/10 text-amber-500 hover:text-amber-300'
                                : 'border-emerald-500/30 bg-transparent hover:bg-emerald-500/10 text-emerald-500 hover:text-emerald-300'
                            }`}
                          >
                            {togglingGate === gate.id
                              ? '…'
                              : gate.status === 'operational' ? '⚠ Mark Service Needed' : '✓ Mark Operational'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Comms Log Tab ────────────────────────────────────────────────────── */}
      {activeTab === 'comms' && (
        <div className="flex-1 overflow-y-auto p-5">
          {/* Filter row */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {/* Date range */}
            <div className="flex items-center gap-0.5 bg-white/[0.04] border border-white/[0.06] rounded-md p-0.5">
              {(['today','7d','30d','all'] as DateRange[]).map(r => (
                <button key={r} onClick={() => setCommsRange(r)}
                  className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${commsRange === r ? 'bg-indigo-600/60 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                  {r === 'today' ? 'Today' : r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : 'All'}
                </button>
              ))}
            </div>
            {/* Type filter */}
            <div className="flex items-center gap-0.5 bg-white/[0.04] border border-white/[0.06] rounded-md p-0.5">
              {(['all','call','email'] as const).map(t => (
                <button key={t} onClick={() => setCommsTypeFilter(t)}
                  className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${commsTypeFilter === t ? 'bg-indigo-600/60 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                  {t === 'all' ? 'All' : t === 'call' ? '📞 Calls' : '✉ Emails'}
                </button>
              ))}
            </div>
            {/* Site search */}
            <input
              value={commsSiteSearch}
              onChange={e => setCommsSiteSearch(e.target.value)}
              placeholder="Filter by site or contact…"
              className="px-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded text-[10px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 w-52"
            />
            <button onClick={fetchComms}
              className="ml-auto px-3 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider bg-white/[0.04] border border-white/[0.06] text-slate-400 hover:text-white transition-all">
              Refresh
            </button>
          </div>

          {/* Table */}
          {commsLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="border border-white/[0.06] rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#030406] border-b border-white/[0.06]">
                    <th className="px-4 py-2.5 text-[9px] font-semibold text-slate-500 uppercase tracking-[0.1em] w-8">Type</th>
                    <th className="px-4 py-2.5 text-[9px] font-semibold text-slate-500 uppercase tracking-[0.1em]">Contact</th>
                    <th className="px-4 py-2.5 text-[9px] font-semibold text-slate-500 uppercase tracking-[0.1em]">Site</th>
                    <th className="px-4 py-2.5 text-[9px] font-semibold text-slate-500 uppercase tracking-[0.1em]">Detail</th>
                    <th className="px-4 py-2.5 text-[9px] font-semibold text-slate-500 uppercase tracking-[0.1em] w-28">Operator</th>
                    <th className="px-4 py-2.5 text-[9px] font-semibold text-slate-500 uppercase tracking-[0.1em] w-36">Date / Time</th>
                  </tr>
                </thead>
                <tbody>
                  {commsEntries
                    .filter(e => commsTypeFilter === 'all' || e.type === commsTypeFilter)
                    .filter(e => {
                      if (!commsSiteSearch) return true;
                      const s = commsSiteSearch.toLowerCase();
                      return e.site_name.toLowerCase().includes(s) || e.contact.toLowerCase().includes(s) || e.operator_name.toLowerCase().includes(s);
                    })
                    .map((e, i) => (
                      <tr key={e.id} className={`border-b border-white/[0.04] ${i % 2 === 0 ? 'bg-white/[0.005]' : ''} hover:bg-indigo-600/[0.04] transition-colors`}>
                        <td className="px-4 py-2.5">
                          <span className="text-[14px]">{e.type === 'call' ? '📞' : '✉️'}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[11px] font-mono text-slate-200 truncate max-w-[180px] block">{e.contact}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[11px] text-slate-400 truncate max-w-[160px] block">{e.site_name || '—'}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[10px] text-slate-500 capitalize">{e.detail}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[10px] text-slate-500 truncate block">{e.operator_name || '—'}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[10px] text-slate-600 font-mono whitespace-nowrap">{fmtDateTime(e.created_at)}</span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {commsEntries.filter(e => commsTypeFilter === 'all' || e.type === commsTypeFilter).length === 0 && (
                <p className="text-[10px] text-slate-700 text-center py-10">No comms activity in this range.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Incidents Table ───────────────────────────────────────────────── */}
      {activeTab === 'incidents' && <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] text-slate-600 uppercase tracking-wider">Loading reports…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-center">
            <p className="text-[13px] text-slate-600">No reports found</p>
            <p className="text-[10px] text-slate-700">
              {reports.length === 0
                ? 'Resolved incidents will appear here once operators close alarms.'
                : 'Try adjusting the date range or search.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#030406] border-b border-white/[0.06]">
                <th className="px-4 py-2.5 text-[9px] font-semibold text-slate-500 uppercase tracking-[0.1em] w-40">Date / Time</th>
                <th className="px-4 py-2.5 text-[9px] font-semibold text-slate-500 uppercase tracking-[0.1em]">Site</th>
                <th className="px-4 py-2.5 text-[9px] font-semibold text-slate-500 uppercase tracking-[0.1em] w-12">P</th>
                <th className="px-4 py-2.5 text-[9px] font-semibold text-slate-500 uppercase tracking-[0.1em]">Event</th>
                <th className="px-4 py-2.5 text-[9px] font-semibold text-slate-500 uppercase tracking-[0.1em] w-44">Action Taken</th>
                <th className="px-4 py-2.5 text-[9px] font-semibold text-slate-500 uppercase tracking-[0.1em] w-28">Operator</th>
                <th className="px-4 py-2.5 text-[9px] font-semibold text-slate-500 uppercase tracking-[0.1em]">Notes</th>
                <th className="px-4 py-2.5 w-16" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const priority = r.alarms?.priority ?? 'P4';
                const pcfg = PRIORITY_CONFIG[priority as Priority] ?? PRIORITY_CONFIG.P4;
                const action = r.action_taken ?? '';
                const actionLabel = ACTION_LABELS[action] ?? action ?? '—';
                const actionColor = ACTION_COLORS[action] ?? ACTION_COLORS.other;
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedReport(r)}
                    className={`
                      border-b border-white/[0.04] cursor-pointer transition-colors
                      ${i % 2 === 0 ? 'bg-white/[0.005]' : ''}
                      hover:bg-indigo-600/[0.06]
                    `}
                  >
                    {/* Date/Time */}
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                        {fmtDateTime(r.generated_at)}
                      </span>
                    </td>

                    {/* Site */}
                    <td className="px-4 py-2.5">
                      <span className="text-[11px] font-semibold text-white truncate max-w-[160px] block">
                        {r.alarms?.site_name ?? '—'}
                      </span>
                      {r.alarms?.cameras?.name && (
                        <span className="text-[9px] text-slate-600 truncate max-w-[160px] block">
                          {r.alarms.cameras.name}
                        </span>
                      )}
                    </td>

                    {/* Priority */}
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 text-[9px] font-bold ${pcfg.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${pcfg.dot}`} />
                        {priority}
                      </span>
                    </td>

                    {/* Event */}
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] text-slate-300 truncate max-w-[200px] block">
                        {r.alarms?.event_label ?? '—'}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-4 py-2.5">
                      {action ? (
                        <span className={`inline-block px-1.5 py-0.5 rounded border text-[9px] font-semibold truncate ${actionColor}`}>
                          {actionLabel}
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-600">—</span>
                      )}
                    </td>

                    {/* Operator */}
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] text-slate-400 truncate max-w-[100px] block">
                        {r.operator_name ?? r.operator_id ?? '—'}
                      </span>
                    </td>

                    {/* Notes preview */}
                    <td className="px-4 py-2.5 max-w-[220px]">
                      {r.notes ? (
                        <span className="text-[10px] text-slate-500 line-clamp-1 block">
                          {r.notes}
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-700">—</span>
                      )}
                    </td>

                    {/* View button */}
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-[9px] text-indigo-400 hover:text-indigo-300 font-semibold uppercase tracking-wider">
                        View →
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>}

      {/* ── Report Detail Modal ───────────────────────────────────────────── */}
      {selectedReport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6"
          onClick={() => setSelectedReport(null)}
        >
          <div
            className="bg-[#0c0e14] border border-white/[0.08] rounded-xl shadow-2xl w-full max-w-xl flex flex-col max-h-[85vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
              <div>
                <p className="text-[13px] font-bold text-white">
                  {selectedReport.alarms?.site_name ?? 'Incident Report'}
                </p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                  {fmtDateTime(selectedReport.generated_at)}
                  {selectedReport.alarms?.priority && (
                    <span className={`ml-2 ${PRIORITY_CONFIG[selectedReport.alarms.priority]?.color ?? ''}`}>
                      {selectedReport.alarms.priority}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyReport}
                  className="px-2.5 py-1 rounded border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-[10px] text-slate-400 hover:text-white transition-all"
                >
                  {copied ? '✓ Copied' : 'Copy Report'}
                </button>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="w-7 h-7 flex items-center justify-center rounded border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white transition-all text-sm"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Quick metadata pills */}
            <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-white/[0.04]">
              {selectedReport.action_taken && (
                <span className={`px-2 py-0.5 rounded border text-[9px] font-semibold ${ACTION_COLORS[selectedReport.action_taken] ?? ACTION_COLORS.other}`}>
                  {ACTION_LABELS[selectedReport.action_taken] ?? selectedReport.action_taken}
                </span>
              )}
              {selectedReport.alarms?.event_label && (
                <span className="px-2 py-0.5 rounded border border-white/[0.06] bg-white/[0.03] text-[9px] text-slate-400">
                  {selectedReport.alarms.event_label}
                </span>
              )}
              {selectedReport.operator_name && (
                <span className="px-2 py-0.5 rounded border border-white/[0.06] bg-white/[0.03] text-[9px] text-slate-400">
                  Op: {selectedReport.operator_name}
                </span>
              )}
            </div>

            {/* Report body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {selectedReport.report_body ? (
                <pre className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap font-mono">
                  {selectedReport.report_body}
                </pre>
              ) : (
                <p className="text-[11px] text-slate-600 italic">No report body recorded.</p>
              )}
            </div>

            {/* Notes section (if separate from report body) */}
            {selectedReport.notes && selectedReport.notes.trim() && (
              <div className="px-5 py-3 border-t border-white/[0.06]">
                <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1.5">Operator Notes</p>
                <p className="text-[11px] text-slate-300 leading-relaxed">{selectedReport.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
