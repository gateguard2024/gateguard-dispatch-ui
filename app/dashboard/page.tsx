"use client";

// app/dashboard/page.tsx
// GateGuard Dispatch — Live Dashboard
//
// Data sources (all from Supabase):
//   accounts       → connected site count
//   zones          → SOC-armed zone count
//   cameras        → monitored camera count
//   alarms         → KPIs, charts, live feed
//   incident_reports → recent operator activity
//
// Live updates via Supabase Realtime — new alarms flash into the feed
// instantly. Falls back to polling every 30s if Realtime drops.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────
interface KpiData {
  sitesArmed:       number;
  camerasMonitored: number;
  openAlarms:       number;
  resolvedToday:    number;
  alarmsToday:      number;
}

interface DailyPoint  { date: string; total: number; p1: number; }
interface SitePoint   { site: string; count: number; }
interface TypePoint   { name: string; value: number; }
interface PriorityPt  { name: string; value: number; color: string; }

interface LiveAlarm {
  id:          string;
  priority:    string;
  event_label: string;
  site_name:   string;
  status:      string;
  created_at:  string;
  isNew?:      boolean;
}

interface RecentAction {
  id:            string;
  operator_name: string;
  action_taken:  string;
  notes:         string;
  generated_at:  string;
  zones?:        { name: string } | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PRIORITY_COLORS: Record<string, string> = {
  P1: '#ef4444',
  P2: '#f97316',
  P3: '#6366f1',
  P4: '#475569',
};

const CHART_COLORS = ['#6366f1', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#a855f7'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)   return 'just now';
  if (diffMin < 60)  return `${diffMin}m ago`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function shortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, accent, pulse,
}: {
  label: string; value: string | number; sub?: string; accent?: string; pulse?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 px-4 py-3.5 rounded border border-white/[0.06] bg-white/[0.02]">
      <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-[0.12em]">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-[22px] font-bold leading-none ${accent ?? 'text-white'}`}>{value}</span>
        {pulse && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />}
      </div>
      {sub && <span className="text-[10px] text-slate-600">{sub}</span>}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    P1: 'bg-red-500/15 border-red-500/30 text-red-400',
    P2: 'bg-orange-500/15 border-orange-500/30 text-orange-400',
    P3: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400',
    P4: 'bg-slate-500/15 border-slate-500/30 text-slate-500',
  };
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${colors[priority] ?? colors.P4}`}>
      {priority}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending:    'bg-red-400',
    processing: 'bg-amber-400',
    resolved:   'bg-emerald-400',
  };
  return <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors[status] ?? 'bg-slate-600'}`} />;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0d0f14] border border-white/[0.08] rounded px-3 py-2 text-[10px]">
      {label && <p className="text-slate-400 mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-semibold" style={{ color: p.color ?? p.fill ?? '#6366f1' }}>
          {p.value} {p.name}
        </p>
      ))}
    </div>
  );
}

function SectionHeader({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.12em]">{children}</p>
      {right}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [kpis, setKpis]         = useState<KpiData | null>(null);
  const [daily, setDaily]       = useState<DailyPoint[]>([]);
  const [bySite, setBySite]     = useState<SitePoint[]>([]);
  const [byType, setByType]     = useState<TypePoint[]>([]);
  const [byPriority, setByPriority] = useState<PriorityPt[]>([]);
  const [liveAlarms, setLiveAlarms] = useState<LiveAlarm[]>([]);
  const [recentActions, setRecentActions] = useState<RecentAction[]>([]);
  const [loading, setLoading]   = useState(true);
  const [liveConnected, setLiveConnected] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const newAlarmIds = useRef(new Set<string>());

  // ── Data loaders ─────────────────────────────────────────────────────────
  const loadKpis = useCallback(async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();

    const [
      { count: sitesArmed },
      { count: camerasMonitored },
      { count: openAlarms },
      { count: resolvedToday },
      { count: alarmsToday },
    ] = await Promise.all([
      supabase.from('zones').select('id', { count: 'exact', head: true }).eq('is_monitored', true),
      supabase.from('cameras').select('id', { count: 'exact', head: true }).eq('is_monitored', true),
      supabase.from('alarms').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('alarms').select('id', { count: 'exact', head: true })
        .eq('status', 'resolved').gte('created_at', todayIso),
      supabase.from('alarms').select('id', { count: 'exact', head: true })
        .gte('created_at', todayIso),
    ]);

    setKpis({
      sitesArmed:       sitesArmed       ?? 0,
      camerasMonitored: camerasMonitored ?? 0,
      openAlarms:       openAlarms       ?? 0,
      resolvedToday:    resolvedToday    ?? 0,
      alarmsToday:      alarmsToday      ?? 0,
    });
  }, []);

  const loadDaily = useCallback(async () => {
    const from = new Date();
    from.setDate(from.getDate() - 13);
    from.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('alarms')
      .select('created_at, priority')
      .gte('created_at', from.toISOString())
      .order('created_at');

    // Build 14-day buckets
    const buckets: Record<string, { total: number; p1: number }> = {};
    for (let i = 0; i < 14; i++) {
      const d = new Date(from);
      d.setDate(d.getDate() + i);
      buckets[d.toISOString().slice(0, 10)] = { total: 0, p1: 0 };
    }

    (data ?? []).forEach(r => {
      const key = r.created_at.slice(0, 10);
      if (key in buckets) {
        buckets[key].total++;
        if (r.priority === 'P1') buckets[key].p1++;
      }
    });

    setDaily(
      Object.entries(buckets).map(([date, v]) => ({
        date: shortDate(date),
        total: v.total,
        p1: v.p1,
      }))
    );
  }, []);

  const loadBySite = useCallback(async () => {
    const { data } = await supabase
      .from('alarms')
      .select('site_name')
      .not('site_name', 'is', null);

    const counts: Record<string, number> = {};
    (data ?? []).forEach(r => {
      const n = r.site_name ?? 'Unknown';
      counts[n] = (counts[n] ?? 0) + 1;
    });

    setBySite(
      Object.entries(counts)
        .map(([site, count]) => ({ site: site.length > 20 ? site.slice(0, 18) + '…' : site, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
    );
  }, []);

  const loadByType = useCallback(async () => {
    const { data } = await supabase
      .from('alarms')
      .select('event_label')
      .not('event_label', 'is', null);

    const counts: Record<string, number> = {};
    (data ?? []).forEach(r => {
      const n = r.event_label ?? 'Other';
      counts[n] = (counts[n] ?? 0) + 1;
    });

    setByType(
      Object.entries(counts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6)
    );
  }, []);

  const loadByPriority = useCallback(async () => {
    const { data } = await supabase
      .from('alarms')
      .select('priority')
      .not('priority', 'is', null);

    const counts: Record<string, number> = {};
    (data ?? []).forEach(r => {
      const p = r.priority ?? 'P4';
      counts[p] = (counts[p] ?? 0) + 1;
    });

    setByPriority(
      ['P1', 'P2', 'P3', 'P4']
        .filter(p => counts[p] > 0)
        .map(p => ({ name: p, value: counts[p], color: PRIORITY_COLORS[p] }))
    );
  }, []);

  const loadLiveAlarms = useCallback(async () => {
    const { data } = await supabase
      .from('alarms')
      .select('id, priority, event_label, site_name, status, created_at')
      .order('created_at', { ascending: false })
      .limit(30);

    setLiveAlarms((data ?? []).map(r => ({ ...r, isNew: newAlarmIds.current.has(r.id) })));
  }, []);

  const loadRecentActions = useCallback(async () => {
    const { data } = await supabase
      .from('incident_reports')
      .select('id, operator_name, action_taken, notes, generated_at, zones(name)')
      .order('generated_at', { ascending: false })
      .limit(8);

    setRecentActions(data ?? []);
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([
      loadKpis(),
      loadDaily(),
      loadBySite(),
      loadByType(),
      loadByPriority(),
      loadLiveAlarms(),
      loadRecentActions(),
    ]);
    setLastRefresh(new Date());
    setLoading(false);
  }, [loadKpis, loadDaily, loadBySite, loadByType, loadByPriority, loadLiveAlarms, loadRecentActions]);

  // ── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    loadAll();

    // Fallback polling every 30s
    const poll = setInterval(loadAll, 30_000);

    // Supabase Realtime — new alarms flash into feed instantly
    const channel = supabase
      .channel('dashboard-alarms')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alarms' },
        (payload) => {
          const alarm = payload.new as LiveAlarm;
          newAlarmIds.current.add(alarm.id);
          setLiveAlarms(prev => [{ ...alarm, isNew: true }, ...prev.slice(0, 29)]);
          // Clear the "new" highlight after 5s
          setTimeout(() => {
            newAlarmIds.current.delete(alarm.id);
            setLiveAlarms(prev => prev.map(a => a.id === alarm.id ? { ...a, isNew: false } : a));
          }, 5000);
          // Refresh KPIs when new alarm arrives
          loadKpis();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'alarms' },
        () => { loadKpis(); loadLiveAlarms(); }
      )
      .subscribe((status) => {
        setLiveConnected(status === 'SUBSCRIBED');
      });

    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [loadAll, loadKpis, loadLiveAlarms]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const resolutionRate = kpis && kpis.alarmsToday > 0
    ? Math.round((kpis.resolvedToday / kpis.alarmsToday) * 100)
    : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full flex flex-col overflow-hidden">

      {/* Page header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-white/[0.06] shrink-0">
        <div>
          <h1 className="text-sm font-bold text-white tracking-tight uppercase">
            Dashboard
          </h1>
          <p className="text-[11px] text-slate-600 mt-0.5">
            Refreshed {lastRefresh.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
          </p>
        </div>
        {/* Live indicator */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded border text-[10px] font-bold uppercase tracking-widest ${
          liveConnected
            ? 'bg-emerald-500/[0.08] border-emerald-500/20 text-emerald-400'
            : 'bg-white/[0.02] border-white/[0.06] text-slate-600'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${liveConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
          {liveConnected ? 'Live' : 'Polling'}
        </div>
      </div>

      {/* Body — scrollable */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* ── KPI Row ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard
            label="Sites Armed"
            value={kpis?.sitesArmed ?? 0}
            sub="SOC monitoring on"
            accent="text-emerald-400"
          />
          <KpiCard
            label="Cameras Monitored"
            value={kpis?.camerasMonitored ?? 0}
            sub="Alarm-generating"
          />
          <KpiCard
            label="Open Alarms"
            value={kpis?.openAlarms ?? 0}
            sub="Awaiting dispatch"
            accent={(kpis?.openAlarms ?? 0) > 0 ? 'text-red-400' : 'text-white'}
            pulse={(kpis?.openAlarms ?? 0) > 0}
          />
          <KpiCard
            label="Resolved Today"
            value={kpis?.resolvedToday ?? 0}
            sub={resolutionRate !== null ? `${resolutionRate}% resolution rate` : 'No alarms yet'}
            accent="text-indigo-400"
          />
          <KpiCard
            label="Alarms Today"
            value={kpis?.alarmsToday ?? 0}
            sub="All priorities"
          />
        </div>

        {/* ── Charts ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* 14-day alarm trend */}
          <div className="rounded border border-white/[0.06] bg-white/[0.02] p-4">
            <SectionHeader>Alarms — Last 14 Days</SectionHeader>
            {daily.every(d => d.total === 0) ? (
              <div className="h-36 flex items-center justify-center text-[10px] text-slate-700 uppercase tracking-widest">
                No data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={148}>
                <LineChart data={daily} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} interval={2} />
                  <YAxis tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="total" name="total" stroke="#6366f1" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
                  <Line type="monotone" dataKey="p1" name="P1" stroke="#ef4444" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            )}
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5"><div className="w-4 h-px bg-indigo-500" /><span className="text-[9px] text-slate-600">All alarms</span></div>
              <div className="flex items-center gap-1.5"><div className="w-4 h-px bg-red-500 border-dashed" style={{ borderTop: '1px dashed #ef4444', height: 0 }} /><span className="text-[9px] text-slate-600">P1 only</span></div>
            </div>
          </div>

          {/* Priority breakdown */}
          <div className="rounded border border-white/[0.06] bg-white/[0.02] p-4">
            <SectionHeader>Alarm Priority Breakdown</SectionHeader>
            {byPriority.length === 0 ? (
              <div className="h-36 flex items-center justify-center text-[10px] text-slate-700 uppercase tracking-widest">
                No data yet
              </div>
            ) : (
              <div className="flex items-center gap-6 h-36">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie data={byPriority} cx="50%" cy="50%" innerRadius={32} outerRadius={52} paddingAngle={2} dataKey="value">
                      {byPriority.map((p, i) => <Cell key={i} fill={p.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2.5">
                  {byPriority.map((p) => {
                    const total = byPriority.reduce((s, x) => s + x.value, 0);
                    const pct   = total > 0 ? Math.round((p.value / total) * 100) : 0;
                    return (
                      <div key={p.name}>
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-sm" style={{ background: p.color }} />
                            <span className="text-[10px] font-bold text-slate-300">{p.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">{p.value} <span className="text-slate-600">({pct}%)</span></span>
                        </div>
                        <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: p.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Events by site */}
          <div className="rounded border border-white/[0.06] bg-white/[0.02] p-4">
            <SectionHeader>Events by Site (All Time)</SectionHeader>
            {bySite.length === 0 ? (
              <div className="h-36 flex items-center justify-center text-[10px] text-slate-700 uppercase tracking-widest">
                No data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={148}>
                <BarChart data={bySite} layout="vertical" margin={{ top: 0, right: 4, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} />
                  <YAxis type="category" dataKey="site" tick={{ fill: '#94a3b8', fontSize: 9 }} tickLine={false} width={90} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name="events" fill="#6366f1" radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Event type breakdown */}
          <div className="rounded border border-white/[0.06] bg-white/[0.02] p-4">
            <SectionHeader>Top Event Types</SectionHeader>
            {byType.length === 0 ? (
              <div className="h-36 flex items-center justify-center text-[10px] text-slate-700 uppercase tracking-widest">
                No data yet
              </div>
            ) : (
              <div className="flex items-center gap-5 h-36">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie data={byType} cx="50%" cy="50%" innerRadius={32} outerRadius={52} paddingAngle={2} dataKey="value">
                      {byType.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5">
                  {byType.map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-[10px] text-slate-400 truncate flex-1">{t.name}</span>
                      <span className="text-[10px] font-semibold text-slate-300">{t.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom row: Live feed + Recent actions ───────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Live alarm feed */}
          <div className="rounded border border-white/[0.06] bg-white/[0.02] p-4">
            <SectionHeader right={
              liveConnected ? (
                <span className="flex items-center gap-1 text-[9px] text-emerald-500">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                  Real-time
                </span>
              ) : undefined
            }>
              Recent Alarms
            </SectionHeader>

            {liveAlarms.length === 0 ? (
              <div className="h-24 flex items-center justify-center text-[10px] text-slate-700 uppercase tracking-widest">
                No alarms recorded yet
              </div>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
                {liveAlarms.map((alarm) => (
                  <div
                    key={alarm.id}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded border transition-all ${
                      alarm.isNew
                        ? 'border-indigo-500/40 bg-indigo-500/[0.08] animate-pulse'
                        : 'border-white/[0.05] bg-white/[0.01]'
                    }`}
                  >
                    <StatusDot status={alarm.status} />
                    <PriorityBadge priority={alarm.priority} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-slate-200 truncate">{alarm.event_label ?? alarm.priority}</p>
                      <p className="text-[10px] text-slate-600 truncate">{alarm.site_name ?? '—'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-[9px] font-medium uppercase tracking-wide ${
                        alarm.status === 'pending'    ? 'text-red-400' :
                        alarm.status === 'processing' ? 'text-amber-400' : 'text-emerald-400'
                      }`}>{alarm.status}</p>
                      <p className="text-[9px] text-slate-700">{fmtTime(alarm.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent operator actions */}
          <div className="rounded border border-white/[0.06] bg-white/[0.02] p-4">
            <SectionHeader>Recent Operator Activity</SectionHeader>

            {recentActions.length === 0 ? (
              <div className="h-24 flex items-center justify-center text-[10px] text-slate-700 uppercase tracking-widest">
                No incident reports yet
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                {recentActions.map((r) => (
                  <div key={r.id} className="flex items-start gap-3 px-3 py-2.5 rounded border border-white/[0.05] bg-white/[0.01]">
                    {/* Avatar */}
                    <div className="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-indigo-400">
                        {(r.operator_name ?? '?').charAt(0).toUpperCase()}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold text-slate-200 truncate">
                          {r.operator_name ?? 'Operator'}
                        </p>
                        <p className="text-[9px] text-slate-700 shrink-0">{fmtTime(r.generated_at)}</p>
                      </div>
                      {r.action_taken && (
                        <p className="text-[10px] text-indigo-400 font-medium mt-0.5 capitalize">
                          {r.action_taken.replace(/_/g, ' ')}
                        </p>
                      )}
                      {(r as any).zones?.name && (
                        <p className="text-[10px] text-slate-600 truncate">{(r as any).zones.name}</p>
                      )}
                      {r.notes && (
                        <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {r.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
