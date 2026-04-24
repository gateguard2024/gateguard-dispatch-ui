"use client";
// FILE: app/cameras/page.tsx
// GateGuard 5.0 — Cameras Page
// 3-view flow:
//   View 1 — Site Tile Grid  (accounts with camera count + status)
//   View 2 — Camera Wall     (grid of live tiles for selected site)
//   View 3 — Single Camera   (full player + timeline scrubber + notes)
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import SmartVideoPlayer from '@/components/SmartVideoPlayer';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
// ─── Types ────────────────────────────────────────────────────────────────────
interface Account {
  id:            string;
  name:          string;
  address?:      string;
  cameraCount:   number;
  onlineCount:   number;
  hasAlert:      boolean;
  firstSnap:     string | null;   // static snapshot_url (Brivo cameras)
  firstEenCamId: string | null;   // ESN for live snapshot proxy (EEN cameras)
}
interface CameraRow {
  id:              string;
  name:            string;
  source:          'brivo' | 'een';
  brivo_camera_id: string | null;
  een_camera_id:   string | null;
  is_monitored:    boolean;
  snapshot_url:    string | null;
  zone_id:         string;
}
interface Zone {
  id:         string;
  name:       string;
  account_id: string;
}
interface CameraNoteRow {
  id:         string;
  details:    string;
  created_at: string;
}
// ─── SVG Icons ────────────────────────────────────────────────────────────────
const Ic = {
  ArrowLeft: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
    </svg>
  ),
  Camera: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5 20.47 5.78A.75.75 0 0 1 21.75 6v12a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  ),
  Expand: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
    </svg>
  ),
  Film: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75.125V6.375m0 0A1.125 1.125 0 0 1 3.375 5.25h17.25a1.125 1.125 0 0 1 1.125 1.125v12.75a1.125 1.125 0 0 1-1.125 1.125m-17.25 0H6M6 18.375V6.375m0 0h12m-12 0H3.375m14.625 0V18.375M18 6.375v12M18 18.375h1.5c.621 0 1.125-.504 1.125-1.125V6.375M18 18.375H6" />
    </svg>
  ),
  Save: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  ),
  Building: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
    </svg>
  ),
  Play: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
    </svg>
  ),
  Clock: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  ),
};
// ─── Helpers ──────────────────────────────────────────────────────────────────
function camKey(cam: CameraRow): string {
  return cam.brivo_camera_id ?? cam.een_camera_id ?? cam.id;
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}
// ─── Main Component ───────────────────────────────────────────────────────────
export default function CamerasPage() {
  // View state: 1 = tile grid, 2 = camera wall, 3 = single camera
  const [view, setView] = useState<1 | 2 | 3>(1);
  // View 1 data
  const [accounts, setAccounts]   = useState<Account[]>([]);
  const [loading, setLoading]     = useState(true);
  // View 2 data
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [cameras, setCameras]                 = useState<CameraRow[]>([]);
  const [wallLoading, setWallLoading]         = useState(false);
  // View 3 data
  const [selectedCamera, setSelectedCamera]   = useState<CameraRow | null>(null);
  const [recordedUrl, setRecordedUrl]         = useState<string | null>(null);
  const [recordedToken, setRecordedToken]     = useState<string | null>(null);
  const [recordedLoading, setRecordedLoading] = useState(false);
  const [recordedError, setRecordedError]     = useState<string | null>(null);
  const [startTime, setStartTime]             = useState('');
  const [endTime, setEndTime]                 = useState('');
  const [cameraNote, setCameraNote]           = useState('');
  const [notesSaving, setNotesSaving]         = useState(false);
  const [pastNotes, setPastNotes]             = useState<CameraNoteRow[]>([]);
  // ── View 1: Load accounts ─────────────────────────────────────────────────
  useEffect(() => {
    loadAccounts();
  }, []);
  async function loadAccounts() {
    setLoading(true);
    try {
      // Two flat queries instead of a nested join — more reliable across
      // Supabase deployments where FK schema cache may not resolve chains.

      const { data: accts, error: acctErr } = await supabase
        .from('accounts')
        .select('id, name')
        .order('name');

      if (acctErr) { console.error('[cameras] accounts query error:', acctErr); return; }
      if (!accts || accts.length === 0) return;

      // Pull all cameras for these accounts in one query via zones
      const accountIds = accts.map((a: any) => a.id);

      const { data: zones, error: zoneErr } = await supabase
        .from('zones')
        .select('id, account_id')
        .in('account_id', accountIds);

      if (zoneErr) { console.error('[cameras] zones query error:', zoneErr); }

      const zoneIds = (zones ?? []).map((z: any) => z.id);

      let camRows: any[] = [];
      if (zoneIds.length > 0) {
        const { data: cams, error: camErr } = await supabase
          .from('cameras')
          .select('id, zone_id, source, is_monitored, snapshot_url, een_camera_id')
          .in('zone_id', zoneIds);
        if (camErr) console.error('[cameras] cameras query error:', camErr);
        camRows = cams ?? [];
      }

      // Build a zone_id → account_id lookup
      const zoneToAccount: Record<string, string> = {};
      for (const z of (zones ?? [])) zoneToAccount[z.id] = z.account_id;

      // Group cameras by account_id
      const camsByAccount: Record<string, any[]> = {};
      for (const cam of camRows) {
        const acctId = zoneToAccount[cam.zone_id];
        if (!acctId) continue;
        if (!camsByAccount[acctId]) camsByAccount[acctId] = [];
        camsByAccount[acctId].push(cam);
      }

      const mapped: Account[] = accts.map((a: any) => {
        const allCams     = camsByAccount[a.id] ?? [];
        const online      = allCams.filter((c: any) => c.is_monitored).length;
        const snap        = allCams.find((c: any) => c.snapshot_url)?.snapshot_url ?? null;
        // Pick first monitored EEN camera for live snapshot thumbnail
        const firstEenCam = allCams.find((c: any) => c.source === 'een' && c.een_camera_id && c.is_monitored)
                         ?? allCams.find((c: any) => c.source === 'een' && c.een_camera_id);
        return {
          id:            a.id,
          name:          a.name,
          address:       undefined,
          cameraCount:   allCams.length,
          onlineCount:   online,
          hasAlert:      false,
          firstSnap:     snap,
          firstEenCamId: firstEenCam?.een_camera_id ?? null,
        };
      });

      setAccounts(mapped);
    } finally {
      setLoading(false);
    }
  }
  // ── View 2: Load cameras for account ─────────────────────────────────────
  const openAccount = useCallback(async (account: Account) => {
    setSelectedAccount(account);
    setView(2);
    setWallLoading(true);
    // Get zone IDs for this account
    const { data: zones } = await supabase
      .from('zones')
      .select('id')
      .eq('account_id', account.id);

    // Only select id — TypeScript infers { id: string }[] from the narrow select above
    const zoneIds = (zones ?? []).map((z) => z.id);

    if (zoneIds.length === 0) {
      setCameras([]);
      setWallLoading(false);
      return;
    }
    const { data: cams } = await supabase
      .from('cameras')
      .select('id, name, source, brivo_camera_id, een_camera_id, is_monitored, snapshot_url, zone_id')
      .in('zone_id', zoneIds)
      .order('name');
    setCameras((cams as CameraRow[]) ?? []);
    setWallLoading(false);
  }, []);
  // ── View 3: Open single camera ────────────────────────────────────────────
  const openCamera = useCallback(async (cam: CameraRow) => {
    setSelectedCamera(cam);
    setRecordedUrl(null);
    setRecordedError(null);
    setCameraNote('');
    setView(3);
    // Default time range: last 30 min
    const now   = new Date();
    const minus  = new Date(now.getTime() - 30 * 60_000);
    setEndTime(now.toISOString().slice(0, 16));
    setStartTime(minus.toISOString().slice(0, 16));
    // Load past notes
    const { data: notes } = await supabase
      .from('audit_logs')
      .select('id, details, created_at')
      .eq('camera_id', cam.id)
      .eq('action', 'camera_note')
      .order('created_at', { ascending: false })
      .limit(5);
    setPastNotes(notes ?? []);
  }, []);
  // ── Fetch recorded clip ───────────────────────────────────────────────────
  async function loadRecorded() {
    if (!selectedCamera || !selectedAccount) return;
    setRecordedLoading(true);
    setRecordedError(null);
    const endpoint = selectedCamera.source === 'brivo'
      ? '/api/brivo/recorded'
      : '/api/een/recorded';
    try {
      const res  = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          accountId: selectedAccount.id,
          cameraId:  camKey(selectedCamera),
          startTime: new Date(startTime).toISOString(),
          endTime:   new Date(endTime).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? 'No recording found');
      setRecordedUrl(data.url);
      setRecordedToken(data.token ?? null);
    } catch (err: any) {
      setRecordedError(err.message);
    } finally {
      setRecordedLoading(false);
    }
  }
  // ── Save camera note ──────────────────────────────────────────────────────
  async function saveNote() {
    if (!selectedCamera || !cameraNote.trim()) return;
    setNotesSaving(true);
    await supabase.from('audit_logs').insert({
      camera_id:   selectedCamera.id,
      zone_id:     selectedCamera.zone_id,
      operator_id: 'operator-1',
      action:      'camera_note',
      details:     cameraNote.trim(),
      created_at:  new Date().toISOString(),
    });
    setPastNotes(prev => [{
      id: Date.now().toString(),
      details: cameraNote.trim(),
      created_at: new Date().toISOString(),
    }, ...prev].slice(0, 5));
    setCameraNote('');
    setNotesSaving(false);
  }
  // ─── Render ───────────────────────────────────────────────────────────────
  // ── VIEW 1: Site Tile Grid ────────────────────────────────────────────────
  if (view === 1) {
    return (
      <div className="flex flex-col h-full bg-[#030406] text-white overflow-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 text-slate-400"><Ic.Camera /></div>
            <h1 className="text-[13px] font-semibold text-white uppercase tracking-[0.1em]">Camera Sites</h1>
          </div>
          <span className="text-[10px] text-slate-600">{accounts.length} sites</span>
        </div>
        {/* Grid */}
        <div className="flex-1 p-6">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <div className="w-8 h-8 text-slate-700"><Ic.Building /></div>
              <p className="text-[11px] text-slate-600">No sites configured. Add a site in Setup.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {accounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => openAccount(account)}
                  className="group relative flex flex-col rounded border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12] transition-all text-left overflow-hidden"
                >
                  {/* Thumbnail — EEN live snapshot or static snap */}
                  <div className="aspect-video bg-black relative overflow-hidden">
                    {account.firstEenCamId ? (
                      <img
                        src={`/api/een/image?accountId=${account.id}&cameraId=${account.firstEenCamId}`}
                        alt={account.name}
                        className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : account.firstSnap ? (
                      <img
                        src={account.firstSnap}
                        alt={account.name}
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-8 h-8 text-slate-700"><Ic.Building /></div>
                      </div>
                    )}
                    {/* Status dot */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm border border-white/10 rounded px-2 py-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${account.onlineCount > 0 ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                      <span className="text-[9px] text-white/70">
                        {account.onlineCount}/{account.cameraCount}
                      </span>
                    </div>
                    {/* Hover overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                      <span className="text-[10px] font-semibold text-white uppercase tracking-wider border border-white/30 rounded px-3 py-1">
                        View Cameras →
                      </span>
                    </div>
                  </div>
                  {/* Info */}
                  <div className="px-3 py-2.5">
                    <p className="text-[12px] font-semibold text-white truncate">{account.name}</p>
                    {account.address && (
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">{account.address}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[9px] text-slate-600">
                        {account.cameraCount} camera{account.cameraCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
  // ── VIEW 2: Camera Wall ───────────────────────────────────────────────────
  if (view === 2 && selectedAccount) {
    return (
      <div className="flex flex-col h-full bg-[#030406] text-white overflow-auto">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-3">
          <button
            onClick={() => setView(1)}
            className="w-6 h-6 text-slate-500 hover:text-white transition-colors"
          >
            <Ic.ArrowLeft />
          </button>
          <div className="w-px h-4 bg-white/[0.08]" />
          <div className="w-3.5 h-3.5 text-slate-400"><Ic.Camera /></div>
          <span className="text-[13px] font-semibold text-white">{selectedAccount.name}</span>
          <span className="text-[10px] text-slate-600">
            {cameras.length} camera{cameras.length !== 1 ? 's' : ''}
          </span>
        </div>
        {/* Camera wall */}
        <div className="flex-1 p-3 overflow-auto">
          {wallLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : cameras.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <div className="w-8 h-8 text-slate-700"><Ic.Camera /></div>
              <p className="text-[11px] text-slate-600">No cameras found for this site.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {cameras.map((cam) => {
                const key = camKey(cam);
                return (
                  <div
                    key={cam.id}
                    className="group relative aspect-video rounded border border-white/[0.06] bg-black overflow-hidden cursor-pointer hover:border-white/20 transition-all"
                    onDoubleClick={(e) => { e.stopPropagation(); openCamera(cam); }}
                  >
                    <SmartVideoPlayer
                      accountId={selectedAccount.id}
                      cameraId={key}
                      source={cam.source}
                      streamType="preview"
                      disableFullscreen
                    />
                    {/* Label */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 pointer-events-none">
                      <p className="text-[9px] font-semibold text-white truncate">{cam.name}</p>
                    </div>
                    {/* Status dot */}
                    <div className="absolute top-1.5 left-1.5 pointer-events-none">
                      <span className={`block w-1.5 h-1.5 rounded-full ${cam.is_monitored ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                    </div>
                    {/* Hover actions */}
                    <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); openCamera(cam); }}
                        title="View footage"
                        className="w-6 h-6 flex items-center justify-center rounded bg-black/70 border border-white/20 text-slate-400 hover:text-white transition-colors"
                      >
                        <div className="w-3 h-3"><Ic.Film /></div>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); openCamera(cam); }}
                        title="Expand"
                        className="w-6 h-6 flex items-center justify-center rounded bg-black/70 border border-white/20 text-slate-400 hover:text-white transition-colors"
                      >
                        <div className="w-3 h-3"><Ic.Expand /></div>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }
  // ── VIEW 3: Single Camera Detail ──────────────────────────────────────────
  if (view === 3 && selectedCamera && selectedAccount) {
    const key = camKey(selectedCamera);
    return (
      <div className="flex flex-col h-full bg-[#030406] text-white overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-3">
          <button
            onClick={() => setView(2)}
            className="w-6 h-6 text-slate-500 hover:text-white transition-colors"
          >
            <Ic.ArrowLeft />
          </button>
          <div className="w-px h-4 bg-white/[0.08]" />
          <div className="w-3.5 h-3.5 text-slate-400"><Ic.Camera /></div>
          <span className="text-[13px] font-semibold text-white">{selectedCamera.name}</span>
          <span className="text-[10px] text-slate-600">{selectedAccount.name}</span>
          <div className="ml-auto flex items-center gap-1.5">
            <span className={`block w-1.5 h-1.5 rounded-full ${selectedCamera.is_monitored ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
            <span className="text-[10px] text-slate-600">{selectedCamera.is_monitored ? 'Monitored' : 'Offline'}</span>
          </div>
        </div>
        {/* Main content */}
        <div className="flex-1 flex min-h-0">
          {/* LEFT: Main player (full-width top 60%) + scrubber */}
          <div className="flex-1 flex flex-col min-w-0 border-r border-white/[0.06]">
            {/* Player — 60% */}
            <div className="bg-black" style={{ height: '60%' }}>
              <SmartVideoPlayer
                accountId={selectedAccount.id}
                cameraId={key}
                source={selectedCamera.source}
                streamType="main"
                recordedUrl={recordedUrl ?? undefined}
                recordedToken={recordedToken ?? undefined}
                label={selectedCamera.name}
              />
            </div>
            {/* Timeline scrubber — 40% */}
            <div className="flex-1 overflow-y-auto p-4 border-t border-white/[0.06]">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3.5 h-3.5 text-slate-500"><Ic.Clock /></div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Recorded Footage</span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-[9px] text-slate-500 uppercase tracking-wider mb-1">Start</label>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2.5 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500/50 [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-slate-500 uppercase tracking-wider mb-1">End</label>
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2.5 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500/50 [color-scheme:dark]"
                  />
                </div>
              </div>
              {recordedError && (
                <p className="text-[10px] text-red-400 mb-2">{recordedError}</p>
              )}
              <button
                onClick={loadRecorded}
                disabled={recordedLoading || !startTime || !endTime}
                className="flex items-center gap-2 px-4 py-2 rounded bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-300 text-[11px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {recordedLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <div className="w-3.5 h-3.5"><Ic.Play /></div>
                )}
                {recordedLoading ? 'Fetching...' : 'Load Recorded Clip'}
              </button>
              {recordedUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span className="text-[10px] text-amber-400">Playing recorded clip — double-click player for fullscreen</span>
                  <button
                    onClick={() => setRecordedUrl(null)}
                    className="text-[9px] text-slate-500 hover:text-white underline ml-auto"
                  >
                    Back to live
                  </button>
                </div>
              )}
            </div>
          </div>
          {/* RIGHT: Camera notes */}
          <div className="w-[280px] shrink-0 flex flex-col">
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Camera Notes</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {/* Input */}
              <textarea
                value={cameraNote}
                onChange={e => setCameraNote(e.target.value)}
                placeholder="Add a note about this camera..."
                rows={4}
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded px-3 py-2 text-[11px] text-slate-300 placeholder-slate-600 resize-none focus:outline-none focus:border-indigo-500/50"
              />
              <button
                onClick={saveNote}
                disabled={!cameraNote.trim() || notesSaving}
                className="flex items-center justify-center gap-2 w-full py-2 rounded bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 text-[10px] font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <div className="w-3.5 h-3.5"><Ic.Save /></div>
                {notesSaving ? 'Saving...' : 'Save Note'}
              </button>
              {/* Past notes */}
              {pastNotes.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                  <p className="text-[9px] text-slate-600 uppercase tracking-wider">Recent Notes</p>
                  {pastNotes.map((note) => (
                    <div
                      key={note.id}
                      className="px-2.5 py-2 rounded bg-white/[0.02] border border-white/[0.05]"
                    >
                      <p className="text-[10px] text-slate-300 leading-relaxed">{note.details}</p>
                      <p className="text-[9px] text-slate-600 mt-1">{fmtTime(note.created_at)}</p>
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
  return null;
}
