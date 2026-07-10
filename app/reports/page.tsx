"use client";

// FILE: app/reports/page.tsx
// GateGuard 5.0 — Incident Reports
// Lists all resolved incidents written by the alarms page.
// Columns: date/time · site · priority · event · action · operator · notes preview
// Click any row to expand the full report body.

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Types ────────────────────────────────────────────────────────────────────
type Priority = 'P1' | 'P2' | 'P3' | 'P4';
type DateRange = 'today' | '7d' | '30d' | 'all';

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
  const [reports, setReports]         = useState<IncidentReport[]>([]);
  const [loading, setLoading]         = useState(true);
  const [dateRange, setDateRange]     = useState<DateRange>('30d');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [search, setSearch]           = useState('');
  const [selectedReport, setSelectedReport] = useState<IncidentReport | null>(null);
  const [copied, setCopied]           = useState(false);
  const [totalCount, setTotalCount]   = useState(0);

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
        <div>
          <h1 className="text-[15px] font-black tracking-tight text-white uppercase">Incident Reports</h1>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {loading ? 'Loading…' : `${totalCount} report${totalCount !== 1 ? 's' : ''} · showing ${filtered.length}`}
          </p>
        </div>

        {/* Filters row */}
        <div className="flex items-center gap-2 flex-wrap">
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
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
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
      </div>

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
