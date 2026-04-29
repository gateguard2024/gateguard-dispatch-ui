"use client";

// app/dashboard/page.tsx
// GateGuard — Dashboard
// No external chart dependencies — all charts are inline SVG.
// Design language matches alarms / cameras / setup pages throughout.

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────
interface KpiData {
  openAlarms:       number;
  criticalToday:    number;
  resolvedToday:    number;
  armedSites:       number;
  camerasMonitored: number;
  resolutionRate:   number | null;
}

interface GateStatusRow {
  id:               string;
  name:             string;
  gate_type:        string;
  status:           string;
  status_updated_at: string | null;
  status_updated_by: string | null;
  accounts?: { name: string } | null;
}

interface GateStats {
  operational:  number;
  total:        number;
  needsService: GateStatusRow[];
}

interface SlaRow   { label: string; pct: number; color: string; }
interface HourPt   { hour: string; current: number; previous: number; }
interface OperatorRow { name: string; count: number; }
interface RecentAlarm {
  id: string;
  priority: string;
  event_label: string;
  site_name: string;
  status: string;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)    return 'just now';
  if (m < 60)   return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── KPI Card — same style as setup/alarms meta cards ────────────────────────
function KpiCard({ label, value, sub, accent, pulse }: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  pulse?: boolean;
}) {
  return (
    <div className="bg-[#0d0f14] border border-white/[0.06] rounded px-4 py-3.5 flex flex-col gap-1.5">
      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
      <div className="flex items-center gap-2">
        <span className={`text-2xl font-bold leading-none ${accent ?? 'text-white'}`}>{value}</span>
        {pulse && <span className={`w-2 h-2 rounded-full animate-pulse shrink-0 ${accent ?? 'bg-white'}`}
          style={{ background: 'currentColor' }} />}
      </div>
      {sub && <p className="text-[10px] text-slate-600">{sub}</p>}
    </div>
  );
}

// ─── Section header — matches setup page SectionDivider ──────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-3">{children}</p>
  );
}

// ─── Inline sparkline (14 days) ───────────────────────────────────────────────
function Sparkline({ data, color = '#6366f1' }: { data: number[]; color?: string }) {
  if (data.every(v => v === 0)) return (
    <div className="h-12 flex items-center justify-center text-[10px] text-slate-700 uppercase tracking-widest">
      No data yet
    </div>
  );
  const W = 400; const H = 52;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - 4 - ((v / max) * (H - 8));
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const areaPath = `M${pts[0]} L${pts.join(' L')} L${W},${H} L0,${H} Z`;
  const linePath = `M${pts.join(' L')}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 52 }}>
      <defs>
        <linearGradient id="spk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#spk)" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

// ─── Alarms by Hour chart ──────────────────────────────────────────────────────
function HourChart({ data, trendPct }: { data: HourPt[]; trendPct: number | null }) {
  if (data.every(d => d.current === 0 && d.previous === 0)) return (
    <div className="h-36 flex items-center justify-center text-[10px] text-slate-700 uppercase tracking-widest">
      No data yet
    </div>
  );
  const W = 720; const H = 120;
  const PAD = { t: 8, r: 8, b: 24, l: 24 };
  const cW = W - PAD.l - PAD.r;
  const cH = H - PAD.t - PAD.b;
  const max = Math.max(...data.flatMap(d => [d.current, d.previous]), 1);
  const x = (i: number) => PAD.l + (i / (data.length - 1)) * cW;
  const y = (v: number) => PAD.t + cH - (v / max) * cH;
  const line = (k: 'current' | 'previous') =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(' ');
  const area = (k: 'current' | 'previous') => {
    const lx = x(data.length - 1).toFixed(1);
    const by = (PAD.t + cH).toFixed(1);
    return `${line(k)} L${lx},${by} L${PAD.l},${by} Z`;
  };
  const trendColor  = trendPct === null ? '#475569' : trendPct > 0 ? '#ef4444' : '#22c55e';
  const trendSymbol = trendPct === null ? '' : trendPct > 0 ? '▲' : '▼';

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-indigo-400" />
            <span className="text-[10px] text-slate-600">Current 24h</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-white/20" />
            <span className="text-[10px] text-slate-600">Previous 24h</span>
          </div>
        </div>
        {trendPct !== null && (
          <span className="text-[11px] font-bold" style={{ color: trendColor }}>
            {trendSymbol} {Math.abs(trendPct)}%
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
        <defs>
          <linearGradient id="hgCur" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.01" />
          </linearGradient>
          <linearGradient id="hgPrev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map(f => (
          <line key={f} x1={PAD.l} y1={PAD.t + cH * (1 - f)} x2={PAD.l + cW} y2={PAD.t + cH * (1 - f)}
            stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        ))}
        <path d={area('previous')} fill="url(#hgPrev)" />
        <path d={area('current')}  fill="url(#hgCur)" />
        <path d={line('previous')} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        <path d={line('current')}  fill="none" stroke="#6366f1" strokeWidth="2" />
        {data.filter((_, i) => i % 4 === 0).map((d, i) => {
          const idx = data.indexOf(d);
          return (
            <text key={i} x={x(idx)} y={H - 5} textAnchor="middle" fill="#475569" fontSize="10">
              {d.hour}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Priority badge ───────────────────────────────────────────────────────────
function PBadge({ p }: { p: string }) {
  const cls: Record<string, string> = {
    P1: 'bg-red-500/15 border-red-500/30 text-red-400',
    P2: 'bg-orange-500/15 border-orange-500/30 text-orange-400',
    P3: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400',
  };
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${cls[p] ?? 'bg-white/5 border-white/10 text-slate-500'}`}>
      {p}
    </span>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [kpis,      setKpis]      = useState<KpiData | null>(null);
  const [sla,       setSla]       = useState<SlaRow[]>([]);
  const [daily,     setDaily]     = useState<number[]>([]);
  const [hourData,  setHourData]  = useState<HourPt[]>([]);
  const [operators, setOperators] = useState<OperatorRow[]>([]);
  const [recent,    setRecent]    = useState<RecentAlarm[]>([]);
  const [trendPct,  setTrendPct]  = useState<number | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [liveOn,    setLiveOn]    = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [gateStats, setGateStats] = useState<GateStats | null>(null);

  const loadKpis = useCallback(async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();
    const [
      { count: openAlarms },
      { count: criticalToday },
      { count: resolvedToday },
      { count: allToday },
      { count: armedSites },
      { count: camerasMonitored },
    ] = await Promise.all([
      supabase.from('alarms').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('alarms').select('id', { count: 'exact', head: true }).in('priority', ['P1', 'P2']).gte('created_at', todayIso),
      supabase.from('alarms').select('id', { count: 'exact', head: true }).eq('status', 'resolved').gte('created_at', todayIso),
      supabase.from('alarms').select('id', { count: 'exact', head: true }).gte('created_at', todayIso),
      supabase.from('zones').select('id', { count: 'exact', head: true }).eq('is_monitored', true),
      supabase.from('cameras').select('id', { count: 'exact', head: true }).eq('is_monitored', true),
    ]);
    const total = allToday ?? 0;
    const resolved = resolvedToday ?? 0;
    setKpis({
      openAlarms:       openAlarms       ?? 0,
      criticalToday:    criticalToday    ?? 0,
      resolvedToday:    resolved,
      armedSites:       armedSites       ?? 0,
      camerasMonitored: camerasMonitored ?? 0,
      resolutionRate:   total > 0 ? Math.round((resolved / total) * 100) : null,
    });
  }, []);

  const loadSla = useCallback(async () => {
    const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
    const { data: reports } = await supabase
      .from('incident_reports')
      .select('generated_at, alarm_id')
      .gte('generated_at', since)
      .not('alarm_id', 'is', null);

    if (!reports?.length) {
      setSla([
        { label: '< 30s', pct: 0, color: '#6366f1' },
        { label: '< 60s', pct: 0, color: '#6366f1' },
        { label: '< 90s', pct: 0, color: '#6366f1' },
        { label: '< 3m',  pct: 0, color: '#6366f1' },
      ]);
      return;
    }
    const ids = reports.map(r => r.alarm_id).filter(Boolean).slice(0, 100);
    const { data: alarms } = await supabase.from('alarms').select('id, created_at').in('id', ids);
    const aMap = new Map((alarms ?? []).map(a => [a.id, a.created_at]));
    const diffs = reports
      .map(r => {
        const ts = aMap.get(r.alarm_id);
        if (!ts) return null;
        return (new Date(r.generated_at).getTime() - new Date(ts).getTime()) / 1000;
      })
      .filter((d): d is number => d !== null && d >= 0);
    const n = diffs.length || 1;
    const p = (t: number) => Math.round((diffs.filter(d => d <= t).length / n) * 100);
    setSla([
      { label: '< 30s', pct: p(30),  color: p(30)  >= 80 ? '#22c55e' : p(30)  >= 50 ? '#eab308' : '#ef4444' },
      { label: '< 60s', pct: p(60),  color: p(60)  >= 80 ? '#22c55e' : p(60)  >= 50 ? '#eab308' : '#ef4444' },
      { label: '< 90s', pct: p(90),  color: p(90)  >= 80 ? '#22c55e' : p(90)  >= 50 ? '#eab308' : '#ef4444' },
      { label: '< 3m',  pct: p(180), color: p(180) >= 80 ? '#22c55e' : p(180) >= 50 ? '#eab308' : '#ef4444' },
    ]);
  }, []);

  const loadDaily = useCallback(async () => {
    const from = new Date();
    from.setDate(from.getDate() - 13);
    from.setHours(0, 0, 0, 0);
    const { data } = await supabase.from('alarms').select('created_at').gte('created_at', from.toISOString());
    const buckets: Record<string, number> = {};
    for (let i = 0; i < 14; i++) {
      const d = new Date(from);
      d.setDate(d.getDate() + i);
      buckets[d.toISOString().slice(0, 10)] = 0;
    }
    (data ?? []).forEach(r => {
      const k = r.created_at.slice(0, 10);
      if (k in buckets) buckets[k]++;
    });
    setDaily(Object.values(buckets));
  }, []);

  const loadHour = useCallback(async () => {
    const now = Date.now();
    const [{ data: cur }, { data: prev }] = await Promise.all([
      supabase.from('alarms').select('created_at').gte('created_at', new Date(now - 24 * 3600_000).toISOString()),
      supabase.from('alarms').select('created_at').gte('created_at', new Date(now - 48 * 3600_000).toISOString()).lt('created_at', new Date(now - 24 * 3600_000).toISOString()),
    ]);
    const bucket = (rows: { created_at: string }[]) => {
      const c: Record<number, number> = {};
      for (let h = 0; h < 24; h++) c[h] = 0;
      (rows ?? []).forEach(r => { const h = new Date(r.created_at).getHours(); c[h]++; });
      return c;
    };
    const cB = bucket(cur ?? []);
    const pB = bucket(prev ?? []);
    const pts: HourPt[] = [];
    for (let h = 0; h < 24; h++) {
      pts.push({ hour: `${h.toString().padStart(2, '0')}:00`, current: cB[h], previous: pB[h] });
    }
    setHourData(pts);
    const cT = Object.values(cB).reduce((a, b) => a + b, 0);
    const pT = Object.values(pB).reduce((a, b) => a + b, 0);
    setTrendPct(pT > 0 ? Math.round(((cT - pT) / pT) * 100) : null);
  }, []);

  const loadOperators = useCallback(async () => {
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data } = await supabase.from('incident_reports').select('operator_name').gte('generated_at', since).not('operator_name', 'is', null);
    const counts: Record<string, number> = {};
    (data ?? []).forEach(r => { const n = r.operator_name ?? 'Unknown'; counts[n] = (counts[n] ?? 0) + 1; });
    setOperators(Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5));
  }, []);

  const loadRecent = useCallback(async () => {
    const { data } = await supabase.from('alarms').select('id, priority, event_label, site_name, status, created_at').order('created_at', { ascending: false }).limit(15);
    setRecent(data ?? []);
  }, []);

  const loadGates = useCallback(async () => {
    // Two-step: avoid FK join dependency on gates.account_id → accounts.id
    const [{ data: gateData, error }, { data: accountData }] = await Promise.all([
      supabase.from('gates').select('id, name, gate_type, status, status_updated_at, status_updated_by, account_id').order('name'),
      supabase.from('accounts').select('id, name').order('name'),
    ]);
    if (error) {
      // gates table may not exist yet — show empty state gracefully
      setGateStats({ total: 0, operational: 0, needsService: [] });
      return;
    }
    const accountMap: Record<string, string> = Object.fromEntries(
      (accountData ?? []).map((a: any) => [a.id, a.name])
    );
    const rows = (gateData ?? []).map((g: any) => ({
      ...g,
      accounts: accountMap[g.account_id] ? { name: accountMap[g.account_id] } : null,
    })) as unknown as GateStatusRow[];
    const needsService = rows.filter(g => g.status === 'needs_service');
    setGateStats({
      total:        rows.length,
      operational:  rows.filter(g => g.status === 'operational').length,
      needsService,
    });
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([loadKpis(), loadSla(), loadDaily(), loadHour(), loadOperators(), loadRecent(), loadGates()]);
    setLastUpdate(new Date());
    setLoading(false);
  }, [loadKpis, loadSla, loadDaily, loadHour, loadOperators, loadRecent, loadGates]);

  useEffect(() => {
    loadAll();
    const poll = setInterval(loadAll, 30_000);
    const ch = supabase.channel('dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alarms' }, () => { loadKpis(); loadHour(); loadRecent(); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'incident_reports' }, () => { loadSla(); loadOperators(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gates' }, () => { loadGates(); })
      .subscribe(s => setLiveOn(s === 'SUBSCRIBED'));
    return () => { clearInterval(poll); supabase.removeChannel(ch); };
  }, [loadAll, loadKpis, loadHour, loadRecent, loadSla, loadOperators, loadGates]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-white/[0.06] shrink-0">
        <div>
          <h1 className="text-sm font-bold text-white tracking-tight uppercase">Dashboard</h1>
          <p className="text-[11px] text-slate-600 mt-0.5">
            Live performance across all monitored sites
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-700 font-mono">
            {lastUpdate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
          </span>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-[10px] font-bold uppercase tracking-widest ${
            liveOn ? 'bg-emerald-500/[0.08] border-emerald-500/20 text-emerald-400' : 'bg-[#0d0f14] border-white/[0.06] text-slate-600'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${liveOn ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            {liveOn ? 'Live' : 'Polling'}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* ── KPI Row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard
            label="Open Alarms"
            value={kpis?.openAlarms ?? 0}
            accent={(kpis?.openAlarms ?? 0) > 0 ? 'text-red-400' : 'text-white'}
            pulse={(kpis?.openAlarms ?? 0) > 0}
            sub="Awaiting dispatch"
          />
          <KpiCard
            label="P1 / P2 Today"
            value={kpis?.criticalToday ?? 0}
            accent={(kpis?.criticalToday ?? 0) > 0 ? 'text-orange-400' : 'text-white'}
            sub="Critical priority"
          />
          <KpiCard
            label="Resolved Today"
            value={kpis?.resolvedToday ?? 0}
            accent="text-indigo-400"
            sub={kpis?.resolutionRate !== null ? `${kpis?.resolutionRate}% rate` : 'No alarms yet'}
          />
          <KpiCard
            label="Armed Sites"
            value={kpis?.armedSites ?? 0}
            accent="text-emerald-400"
            sub="SOC monitoring on"
          />
          <KpiCard
            label="Cameras"
            value={kpis?.camerasMonitored ?? 0}
            sub="Monitored"
          />
        </div>

        {/* ── Gate Status Panel ── */}
        <div className={`rounded border px-4 py-3.5 ${
          gateStats && gateStats.needsService.length > 0
            ? 'border-amber-500/25 bg-amber-500/[0.03]'
            : 'border-white/[0.06] bg-[#0d0f14]'
        }`}>
          {/* Panel header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Gate Status</p>
              {gateStats && gateStats.total > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-semibold text-emerald-400">
                    {gateStats.operational} operational
                  </span>
                  {gateStats.needsService.length > 0 && (
                    <>
                      <span className="text-slate-700">·</span>
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        {gateStats.needsService.length} need{gateStats.needsService.length === 1 ? 's' : ''} service
                      </span>
                    </>
                  )}
                  <span className="text-slate-700">·</span>
                  <span className="text-[10px] text-slate-600">{gateStats.total} total</span>
                </div>
              )}
            </div>
            <a
              href="/reports"
              className="text-[9px] text-slate-600 hover:text-indigo-400 font-semibold border border-white/[0.06] hover:border-indigo-500/30 rounded px-2.5 py-1 transition-colors"
            >
              Manage in Reports →
            </a>
          </div>

          {/* Content */}
          {!gateStats || gateStats.total === 0 ? (
            <p className="text-[10px] text-slate-700 py-1">
              {!gateStats ? 'Loading…' : 'No gates configured — add gates in Setup → select zone → Gates tab'}
            </p>
          ) : gateStats.needsService.length === 0 ? (
            /* All clear state */
            <div className="flex items-center gap-2.5 py-1">
              <div className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <p className="text-[11px] text-emerald-400 font-semibold">All {gateStats.total} gates operational</p>
            </div>
          ) : (
            /* Needs service list */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {gateStats.needsService.map(g => (
                <div key={g.id} className="flex items-start gap-2.5 px-3 py-2.5 rounded border border-amber-500/20 bg-amber-500/[0.05]">
                  <span className="text-amber-400 text-[13px] leading-none mt-0.5 shrink-0">⚠</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-white truncate">{g.name}</p>
                    <p className="text-[9px] text-slate-500 truncate mt-0.5">
                      {(g.accounts as any)?.name ?? 'Unknown site'}
                      {g.gate_type ? ` · ${g.gate_type}` : ''}
                    </p>
                    {g.status_updated_by && (
                      <p className="text-[8px] text-slate-600 mt-0.5">
                        Flagged by {g.status_updated_by.split(' ')[0]}
                        {g.status_updated_at ? ` · ${fmtAgo(g.status_updated_at)}` : ''}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {/* Filler card showing operational count */}
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded border border-emerald-500/15 bg-emerald-500/[0.03]">
                <svg className="w-3.5 h-3.5 text-emerald-500/60 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                <p className="text-[10px] text-emerald-600 font-medium">
                  {gateStats.operational} gate{gateStats.operational !== 1 ? 's' : ''} operational
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Middle row: trend + SLA ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* 14-day sparkline */}
          <div className="bg-[#0d0f14] border border-white/[0.06] rounded p-4">
            <SectionLabel>Alarms — Last 14 Days</SectionLabel>
            <Sparkline data={daily} />
            <div className="flex items-center justify-between mt-2">
              {daily.reduce((a, b) => a + b, 0) > 0 ? (
                <>
                  <span className="text-[10px] text-slate-600">
                    {daily.reduce((a, b) => a + b, 0)} total events
                  </span>
                  <span className="text-[10px] text-slate-600">
                    avg {(daily.reduce((a, b) => a + b, 0) / 14).toFixed(1)}/day
                  </span>
                </>
              ) : (
                <span className="text-[10px] text-slate-700">No events in window</span>
              )}
            </div>
          </div>

          {/* SLA bars */}
          <div className="bg-[#0d0f14] border border-white/[0.06] rounded p-4">
            <SectionLabel>Response Time SLA — 7 Days</SectionLabel>
            {sla.every(s => s.pct === 0) ? (
              <p className="text-[10px] text-slate-700 py-4 text-center">No response data yet</p>
            ) : (
              <div className="space-y-3 mt-1">
                {sla.map((s, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-slate-400 font-medium">{s.label}</span>
                      <span className="text-[10px] font-bold" style={{ color: s.color }}>{s.pct}%</span>
                    </div>
                    <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${s.pct}%`, background: s.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alarms per operator */}
          <div className="bg-[#0d0f14] border border-white/[0.06] rounded p-4">
            <SectionLabel>Alarms Per Operator — 24h</SectionLabel>
            {operators.length === 0 ? (
              <p className="text-[10px] text-slate-700 py-4 text-center">No activity yet</p>
            ) : (
              <div className="space-y-2.5 mt-1">
                {operators.map((op, i) => {
                  const max = operators[0].count;
                  const pct = Math.round((op.count / max) * 100);
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-slate-300 truncate max-w-[140px]">{op.name}</span>
                        <span className="text-[10px] font-semibold text-slate-400 shrink-0 ml-2">{op.count}</span>
                      </div>
                      <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500/60 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom row: hour chart + recent feed ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          <div className="bg-[#0d0f14] border border-white/[0.06] rounded p-4">
            <SectionLabel>Alarms by Hour</SectionLabel>
            <HourChart data={hourData} trendPct={trendPct} />
          </div>

          <div className="bg-[#0d0f14] border border-white/[0.06] rounded p-4">
            <SectionLabel>Recent Events</SectionLabel>
            {recent.length === 0 ? (
              <p className="text-[10px] text-slate-700 py-4 text-center">No alarms recorded yet</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
                {recent.map(a => (
                  <div key={a.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded border border-white/[0.04] hover:bg-white/[0.02] transition-all">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      a.status === 'pending' ? 'bg-red-400' : a.status === 'processing' ? 'bg-amber-400' : 'bg-emerald-400'
                    }`} />
                    <PBadge p={a.priority} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-slate-200 truncate">{a.event_label ?? a.priority}</p>
                      <p className="text-[10px] text-slate-600 truncate">{a.site_name ?? '—'}</p>
                    </div>
                    <span className="text-[9px] text-slate-700 shrink-0">{fmtAgo(a.created_at)}</span>
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
