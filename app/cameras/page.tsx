"use client";
// FILE: app/cameras/page.tsx
// GateGuard 5.0 — Cameras Page
// 3-view flow:
//   View 1 — Site Tile Grid  (accounts with camera count + status)
//   View 2 — Camera Wall     (grid of live tiles for selected site)
//   View 3 — Single Camera   (full player + timeline scrubber + notes)
import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';
import SmartVideoPlayer from '@/components/SmartVideoPlayer';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
// ─── Types ────────────────────────────────────────────────────────────────────
interface Account {
  id:               string;   // zone ID — tile key + camera loading
  accountId:        string;   // parent account ID — EEN token, audit logs, Brivo
  name:             string;   // zone name  e.g. "Marbella Place"
  subtitle:         string;   // account/owner name  e.g. "Pegasus Properties"
  address?:         string;
  cameraCount:      number;
  onlineCount:      number;
  hasAlert:         boolean;
  firstSnap:        string | null;
  firstEenCamId:    string | null;
  primaryCameraId:  string | null;   // user-selected primary camera
  primaryCameraEsn: string | null;   // ESN of primary camera for live thumbnail
  primaryCameraSnap: string | null;  // static snap fallback for primary camera
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
  brivo_door_id:   string | null;
}
interface BrivoDoor {
  id:   string;
  name: string;
  type: string;
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
  Unlock: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  ),
};
// ─── Helpers ──────────────────────────────────────────────────────────────────
function camKey(cam: CameraRow): string {
  return cam.brivo_camera_id ?? cam.een_camera_id ?? cam.id;
}
/** Returns a datetime-local string in the browser's local timezone (not UTC). */
function toLocalDTString(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}
// ─── Reason → Priority map ────────────────────────────────────────────────────
const REASON_PRIORITY: Record<string, 'P1' | 'P2' | 'P3'> = {
  'Intrusion Detected':    'P1',
  'Suspicious Person':     'P1',
  'Fight / Altercation':   'P1',
  'Weapon Observed':       'P1',
  'Fire / Smoke':          'P1',
  'Vandalism in Progress': 'P1',
  'Loitering':             'P2',
  'Unauthorized Access':   'P2',
  'Gate Left Open':        'P2',
  'Vehicle Blocking':      'P2',
  'Package / Object Left': 'P2',
  'Motion Detected':       'P3',
  'Noise Complaint':       'P3',
  'Welfare Check':         'P3',
  'Other':                 'P3',
};
// ─── Main Component ───────────────────────────────────────────────────────────
export default function CamerasPage() {
  // Clerk identity — used for audit logs and camera notes
  const { user } = useUser();
  const operatorId   = user?.id ?? 'unknown';
  const operatorName = user?.fullName ?? user?.firstName ?? 'Operator';

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
  const [recordedClips, setRecordedClips]     = useState<{ url: string; startTimestamp: string | null; endTimestamp: string | null }[]>([]);
  const [activeClipIdx, setActiveClipIdx]     = useState(0);
  const [playbackSec, setPlaybackSec]         = useState(0);   // video.currentTime of active clip
  const [startTime, setStartTime]             = useState('');
  const [endTime, setEndTime]                 = useState('');
  const [cameraNote, setCameraNote]           = useState('');
  const [notesSaving, setNotesSaving]         = useState(false);
  const [pastNotes, setPastNotes]             = useState<CameraNoteRow[]>([]);
  // Door access state
  const [availableDoors, setAvailableDoors]   = useState<BrivoDoor[]>([]);
  const [linkedDoorId, setLinkedDoorId]       = useState('');
  const [doorOpening, setDoorOpening]         = useState(false);
  const [doorOpened, setDoorOpened]           = useState(false);
  const [doorError, setDoorError]             = useState<string | null>(null);
  // Primary camera state
  const [settingPrimary, setSettingPrimary]   = useState<string | null>(null); // cameraId being set
  // Raise alarm state
  const [raiseAlarmOpen, setRaiseAlarmOpen]   = useState(false);
  const [alarmPriority, setAlarmPriority]     = useState<'P1' | 'P2' | 'P3'>('P2');
  const [alarmReason, setAlarmReason]         = useState('');
  const [alarmNotes, setAlarmNotes]           = useState('');
  const [alarmRaising, setAlarmRaising]       = useState(false);
  const [alarmRaised, setAlarmRaised]         = useState(false);
  // Hold open state
  const [holdMode, setHoldMode]               = useState<'indefinite' | 'until_time'>('indefinite');
  const [holdEndTime, setHoldEndTime]         = useState('');
  const [holdActive, setHoldActive]           = useState(false);
  const [holdActiveUntil, setHoldActiveUntil] = useState<string | null>(null);
  const [holdSetting, setHoldSetting]         = useState(false);
  const [holdReleasing, setHoldReleasing]     = useState(false);
  const [holdError, setHoldError]             = useState<string | null>(null);
  // ── View 1: Load accounts ─────────────────────────────────────────────────
  useEffect(() => {
    loadAccounts();
  }, []);
  async function loadAccounts() {
    setLoading(true);
    try {
      // Load accounts for name lookup
      const { data: accts, error: acctErr } = await supabase
        .from('accounts')
        .select('id, name')
        .order('name');
      if (acctErr) { console.error('[cameras] accounts query error:', acctErr); return; }
      if (!accts || accts.length === 0) return;

      const acctMap: Record<string, string> = {};
      for (const a of accts) acctMap[a.id] = a.name;

      // Load all zones — each zone becomes its own tile
      const accountIds = accts.map((a: any) => a.id);
      const { data: zones, error: zoneErr } = await supabase
        .from('zones')
        .select('id, account_id, name')
        .in('account_id', accountIds)
        .order('name');
      if (zoneErr) { console.error('[cameras] zones query error:', zoneErr); return; }
      if (!zones || zones.length === 0) return;

      const zoneIds = zones.map((z: any) => z.id);

      // Load cameras grouped by zone
      let camRows: any[] = [];
      if (zoneIds.length > 0) {
        const { data: cams, error: camErr } = await supabase
          .from('cameras')
          .select('id, zone_id, source, is_monitored, snapshot_url, een_camera_id')
          .in('zone_id', zoneIds);
        if (camErr) console.error('[cameras] cameras query error:', camErr);
        camRows = cams ?? [];
      }

      const camsByZone: Record<string, any[]> = {};
      for (const cam of camRows) {
        if (!camsByZone[cam.zone_id]) camsByZone[cam.zone_id] = [];
        camsByZone[cam.zone_id].push(cam);
      }

      // One tile per zone
      const mapped: Account[] = zones.map((z: any) => {
        const allCams    = camsByZone[z.id] ?? [];
        const online     = allCams.filter((c: any) => c.is_monitored).length;
        const snap       = allCams.find((c: any) => c.snapshot_url)?.snapshot_url ?? null;
        const firstEenCam = allCams.find((c: any) => c.source === 'een' && c.een_camera_id && c.is_monitored)
                         ?? allCams.find((c: any) => c.source === 'een' && c.een_camera_id);
        return {
          id:                z.id,                      // zone ID
          accountId:         z.account_id,              // parent account ID
          name:              z.name,                    // zone name shown on tile
          subtitle:          acctMap[z.account_id] ?? '', // account/owner name
          address:           undefined,
          cameraCount:       allCams.length,
          onlineCount:       online,
          hasAlert:          false,
          firstSnap:         snap,
          firstEenCamId:     firstEenCam?.een_camera_id ?? null,
          primaryCameraId:   null,
          primaryCameraEsn:  firstEenCam?.een_camera_id ?? null,
          primaryCameraSnap: null,
        };
      });

      setAccounts(mapped);
    } finally {
      setLoading(false);
    }
  }
  // ── View 2: Load cameras for zone (one zone = one tile) ──────────────────
  const openAccount = useCallback(async (account: Account) => {
    setSelectedAccount(account);
    setView(2);
    setWallLoading(true);
    // account.id is the zone ID — load cameras for this zone only
    const { data: cams } = await supabase
      .from('cameras')
      .select('id, name, source, brivo_camera_id, een_camera_id, is_monitored, snapshot_url, zone_id, brivo_door_id')
      .eq('zone_id', account.id)
      .order('name');
    setCameras((cams as CameraRow[]) ?? []);
    setWallLoading(false);
  }, []);
  // ── View 3: Open single camera ────────────────────────────────────────────
  const openCamera = useCallback(async (cam: CameraRow) => {
    setSelectedCamera(cam);
    setRecordedUrl(null);
    setRecordedToken(null);
    setRecordedClips([]);
    setActiveClipIdx(0);
    setRecordedError(null);
    setCameraNote('');
    setDoorOpened(false);
    setDoorError(null);
    setLinkedDoorId(cam.brivo_door_id ?? '');
    setHoldActive(false);
    setHoldActiveUntil(null);
    setHoldError(null);
    setHoldMode('indefinite');
    setRaiseAlarmOpen(false);
    setAlarmRaised(false);
    setAlarmReason('');
    setAlarmNotes('');
    // Default hold end time: 2 hours from now (local time for datetime-local input)
    const twoHours = new Date(Date.now() + 2 * 60 * 60_000);
    setHoldEndTime(toLocalDTString(twoHours));
    setView(3);
    // Default time range: last 30 min (local time for datetime-local input)
    const now  = new Date();
    const minus = new Date(now.getTime() - 30 * 60_000);
    setEndTime(toLocalDTString(now));
    setStartTime(toLocalDTString(minus));
    // Load past notes and account doors in parallel
    const [{ data: notes }, { data: acct }] = await Promise.all([
      supabase
        .from('audit_logs')
        .select('id, details, created_at')
        .eq('account_id', (selectedAccount as Account).accountId)
        .eq('action', 'camera_note')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('accounts')
        .select('brivo_door_ids')
        .eq('id', (selectedAccount as Account).accountId)
        .single(),
    ]);
    const filtered = (notes ?? [])
      .filter((n: any) => {
        try { return JSON.parse(n.details).camera_id === cam.id; } catch { return false; }
      })
      .slice(0, 5);
    setPastNotes(filtered);
    setAvailableDoors((acct as any)?.brivo_door_ids ?? []);
  }, [selectedAccount]);
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
          accountId: selectedAccount.accountId,
          cameraId:  camKey(selectedCamera),
          startTime: new Date(startTime).toISOString(),
          endTime:   new Date(endTime).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? 'No recording found');
      // Store all segments for the navigator — fall back to single-clip shape
      const clips = data.clips ?? [{ url: data.url, startTimestamp: data.startTimestamp ?? null, endTimestamp: data.endTimestamp ?? null }];
      setRecordedClips(clips);
      setActiveClipIdx(0);
      setPlaybackSec(0);
      setRecordedUrl(clips[0].url);
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
    const noteDetails = JSON.stringify({ camera_id: selectedCamera.id, note: cameraNote.trim() });
    await supabase.from('audit_logs').insert({
      account_id:  selectedAccount!.accountId,
      zone_id:     selectedCamera.zone_id,
      operator_id: operatorId,
      action:      'camera_note',
      details:     noteDetails,
      created_at:  new Date().toISOString(),
    });
    setPastNotes(prev => [{
      id: Date.now().toString(),
      details: noteDetails,
      created_at: new Date().toISOString(),
    }, ...prev].slice(0, 5));
    setCameraNote('');
    setNotesSaving(false);
  }
  // ── Open Brivo door associated with this camera ───────────────────────────
  async function openDoor() {
    if (!selectedCamera || !selectedAccount || !linkedDoorId) return;
    setDoorOpening(true);
    setDoorError(null);
    try {
      const res = await fetch('/api/brivo/open', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          accountId:    selectedAccount.accountId,
          doorId:       linkedDoorId,
          operatorId,
          operatorName: operatorName,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? 'Failed to open door');
      setDoorOpened(true);
      setTimeout(() => setDoorOpened(false), 5000);
    } catch (err: any) {
      setDoorError(err.message);
    } finally {
      setDoorOpening(false);
    }
  }
  // ── Link a door to this camera (auto-save on dropdown change) ─────────────
  async function linkDoor(doorId: string) {
    if (!selectedCamera) return;
    setLinkedDoorId(doorId);
    setDoorOpened(false);
    setDoorError(null);
    await supabase
      .from('cameras')
      .update({ brivo_door_id: doorId || null })
      .eq('id', selectedCamera.id);
    // Keep local cameras list in sync
    setCameras(prev => prev.map(c =>
      c.id === selectedCamera.id ? { ...c, brivo_door_id: doorId || null } : c
    ));
  }
  // ── Hold door open ────────────────────────────────────────────────────────
  async function holdOpen() {
    if (!selectedCamera || !selectedAccount || !linkedDoorId) return;
    setHoldSetting(true);
    setHoldError(null);
    try {
      const body: any = {
        accountId:    selectedAccount.accountId,
        doorId:       linkedDoorId,
        mode:         holdMode,
        operatorId:   'operator-1',
        operatorName: 'Operator',
      };
      if (holdMode === 'until_time') body.endTime = new Date(holdEndTime).toISOString();
      const res  = await fetch('/api/brivo/hold', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? 'Failed to set hold');
      setHoldActive(true);
      setHoldActiveUntil(holdMode === 'until_time' ? body.endTime : null);
    } catch (err: any) {
      setHoldError(err.message);
    } finally {
      setHoldSetting(false);
    }
  }
  // ── Set primary camera for site tile ─────────────────────────────────────
  async function setPrimaryCamera(cam: CameraRow) {
    if (!selectedAccount) return;
    setSettingPrimary(cam.id);
    await supabase
      .from('accounts')
      .update({
        primary_camera_id:  cam.id,
        primary_camera_esn: cam.een_camera_id ?? null,
      })
      .eq('id', selectedAccount.accountId);
    // Update local accounts list so tile updates immediately when going back
    setAccounts(prev => prev.map(a =>
      a.id === selectedAccount.id
        ? { ...a, primaryCameraId: cam.id, primaryCameraEsn: cam.een_camera_id ?? null, primaryCameraSnap: cam.snapshot_url ?? null }
        : a
    ));
    setSettingPrimary(null);
  }
  // ── Raise manual alarm from camera view ──────────────────────────────────
  async function raiseAlarm() {
    if (!selectedCamera || !selectedAccount || !alarmReason) return;
    setAlarmRaising(true);
    try {
      const { error } = await supabase.from('alarms').insert({
        priority:    alarmPriority,
        event_type:  'manual.operatorRaisedEvent.v1',
        event_label: alarmReason,
        site_name:   selectedAccount.name,
        camera_id:   selectedCamera.id,
        zone_id:     selectedCamera.zone_id,
        account_id:  selectedAccount.accountId,
        source:      'manual',
        status:      'pending',
        created_at:  new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      // Audit log
      await supabase.from('audit_logs').insert({
        camera_id:   selectedCamera.id,
        zone_id:     selectedCamera.zone_id,
        account_id:  selectedAccount.accountId,
        operator_id: operatorId,
        action:      'manual_alarm_raised',
        details:     JSON.stringify({ priority: alarmPriority, reason: alarmReason, notes: alarmNotes }),
        created_at:  new Date().toISOString(),
      });
      setAlarmRaised(true);    // persists until page refresh — user sees confirmation
      setRaiseAlarmOpen(false);
      setAlarmReason('');
      setAlarmNotes('');
    } catch (err: any) {
      console.error('[raiseAlarm]', err.message);
    } finally {
      setAlarmRaising(false);
    }
  }
  // ── Release hold ──────────────────────────────────────────────────────────
  async function releaseHold() {
    if (!selectedCamera || !selectedAccount || !linkedDoorId) return;
    setHoldReleasing(true);
    setHoldError(null);
    try {
      const res  = await fetch('/api/brivo/hold', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          accountId:    selectedAccount.accountId,
          doorId:       linkedDoorId,
          operatorId,
          operatorName: operatorName,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? 'Failed to release hold');
      setHoldActive(false);
      setHoldActiveUntil(null);
    } catch (err: any) {
      setHoldError(err.message);
    } finally {
      setHoldReleasing(false);
    }
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
                  {/* Thumbnail — live preview stream of primary/first EEN camera */}
                  <div className="aspect-video bg-black relative overflow-hidden">
                    {(() => {
                      const esnToUse  = account.primaryCameraEsn ?? account.firstEenCamId;
                      const snapToUse = account.primaryCameraSnap ?? account.firstSnap;
                      if (esnToUse) return (
                        /* pointer-events-none keeps the tile button clickable */
                        <div className="absolute inset-0 pointer-events-none">
                          <SmartVideoPlayer
                            accountId={account.accountId}
                            cameraId={esnToUse}
                            source="een"
                            streamType="preview"
                            disableFullscreen
                          />
                        </div>
                      );
                      if (snapToUse) return (
                        <img
                          src={snapToUse}
                          alt={account.name}
                          className="w-full h-full object-cover opacity-60"
                        />
                      );
                      return (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-8 h-8 text-slate-700"><Ic.Building /></div>
                        </div>
                      );
                    })()}
                    {/* Primary camera label */}
                    {account.primaryCameraId && (
                      <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-indigo-600/80 backdrop-blur-sm rounded px-1.5 py-0.5 pointer-events-none">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-2.5 h-2.5 text-white"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                        <span className="text-[8px] text-white font-semibold">Primary</span>
                      </div>
                    )}
                    {/* Camera count badge */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm border border-white/10 rounded px-2 py-0.5 pointer-events-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[9px] text-white/80 font-medium">
                        {account.cameraCount} cam{account.cameraCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {/* Hover overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 pointer-events-none">
                      <span className="text-[10px] font-semibold text-white uppercase tracking-wider border border-white/40 rounded px-3 py-1 bg-black/40">
                        View Cameras →
                      </span>
                    </div>
                  </div>
                  {/* Info */}
                  <div className="px-3 py-2.5">
                    <p className="text-[12px] font-semibold text-white truncate">{account.name}</p>
                    {account.subtitle && (
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">{account.subtitle}</p>
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
          <div className="flex flex-col">
            <span className="text-[13px] font-semibold text-white leading-tight">{selectedAccount.name}</span>
            {selectedAccount.subtitle && (
              <span className="text-[10px] text-slate-500 leading-tight">{selectedAccount.subtitle}</span>
            )}
          </div>
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
              {cameras.map((cam, camIdx) => {
                const key = camKey(cam);
                return (
                  <div
                    key={cam.id}
                    className="group relative aspect-video rounded border border-white/[0.06] bg-black overflow-hidden cursor-pointer hover:border-white/20 transition-all"
                    onDoubleClick={(e) => { e.stopPropagation(); openCamera(cam); }}
                  >
                    {/* pointer-events-none so hover actions and double-click on the tile work */}
                    <div className="absolute inset-0 pointer-events-none">
                      <SmartVideoPlayer
                        accountId={selectedAccount.accountId}
                        cameraId={key}
                        source={cam.source}
                        streamType="preview"
                        disableFullscreen
                        startDelay={camIdx * 400}
                      />
                    </div>
                    {/* Label */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 pointer-events-none">
                      <p className="text-[9px] font-semibold text-white truncate">{cam.name}</p>
                    </div>
                    {/* Status dot */}
                    <div className="absolute top-1.5 left-1.5 pointer-events-none">
                      <span className={`block w-1.5 h-1.5 rounded-full ${cam.is_monitored ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                    </div>
                    {/* Primary badge */}
                    {selectedAccount?.primaryCameraId === cam.id && (
                      <div className="absolute top-1.5 left-1.5 pointer-events-none">
                        <div className="flex items-center gap-1 bg-indigo-600/80 backdrop-blur-sm rounded px-1.5 py-0.5">
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-2.5 h-2.5 text-white"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                          <span className="text-[8px] text-white font-semibold">Primary</span>
                        </div>
                      </div>
                    )}
                    {/* Hover actions */}
                    <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); setPrimaryCamera(cam); }}
                        title="Set as site thumbnail"
                        disabled={settingPrimary === cam.id}
                        className={`w-6 h-6 flex items-center justify-center rounded bg-black/70 border transition-colors ${
                          selectedAccount?.primaryCameraId === cam.id
                            ? 'border-indigo-500/60 text-indigo-400'
                            : 'border-white/20 text-slate-400 hover:text-indigo-400 hover:border-indigo-500/40'
                        }`}
                      >
                        {settingPrimary === cam.id
                          ? <div className="w-2.5 h-2.5 border border-indigo-400 border-t-transparent rounded-full animate-spin" />
                          : <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                        }
                      </button>
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
          <span className="text-[10px] text-slate-500">{selectedAccount.name}</span>
          {selectedAccount.subtitle && (
            <span className="text-[10px] text-slate-600">· {selectedAccount.subtitle}</span>
          )}
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
            <div className="bg-black relative" style={{ height: '60%' }}>
              <SmartVideoPlayer
                accountId={selectedAccount.accountId}
                cameraId={key}
                source={selectedCamera.source}
                streamType="preview"
                recordedUrl={recordedUrl ?? undefined}
                recordedToken={recordedToken ?? undefined}
                label={selectedCamera.name}
                onTimeUpdate={setPlaybackSec}
              />
              {/* Wall-clock timestamp overlay — shown during recorded playback */}
              {recordedUrl && recordedClips[activeClipIdx]?.startTimestamp && (
                <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm border border-white/10 rounded px-2 py-1 pointer-events-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-[10px] font-mono text-amber-300 tabular-nums">
                    {new Date(
                      new Date(recordedClips[activeClipIdx].startTimestamp!).getTime() + playbackSec * 1000
                    ).toLocaleString('en-US', {
                      month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit', second: '2-digit',
                      hour12: true,
                    })}
                  </span>
                </div>
              )}
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
                <div className="mt-2 flex flex-col gap-2">
                  {/* Status bar */}
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    <span className="text-[10px] text-amber-400">
                      {recordedClips.length > 1
                        ? `Segment ${activeClipIdx + 1} of ${recordedClips.length} — double-click player for fullscreen`
                        : 'Playing recorded clip — double-click player for fullscreen'}
                    </span>
                    <button
                      onClick={() => { setRecordedUrl(null); setRecordedClips([]); setActiveClipIdx(0); setPlaybackSec(0); }}
                      className="text-[9px] text-slate-500 hover:text-white underline ml-auto shrink-0"
                    >
                      Back to live
                    </button>
                  </div>

                  {/* Segment navigator — only shown when multiple clips */}
                  {recordedClips.length > 1 && (
                    <div className="flex flex-col gap-1.5">
                      <p className="text-[9px] text-slate-500 uppercase tracking-wider">
                        Segments — click to jump · {recordedClips.length} × ~30 min blocks
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {recordedClips.map((clip, idx) => {
                          const label = clip.startTimestamp
                            ? new Date(clip.startTimestamp).toLocaleString('en-US', {
                                month: 'short', day: 'numeric',
                                hour: '2-digit', minute: '2-digit', hour12: true,
                              })
                            : `Seg ${idx + 1}`;
                          const isActive = idx === activeClipIdx;
                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                setActiveClipIdx(idx);
                                setPlaybackSec(0);
                                setRecordedUrl(clip.url);
                              }}
                              title={label}
                              className={`px-2 py-1 rounded border text-[9px] font-medium transition-all whitespace-nowrap ${
                                isActive
                                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                                  : 'bg-white/[0.03] border-white/[0.08] text-slate-500 hover:text-slate-200 hover:border-white/20'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      {/* Prev / Next controls */}
                      <div className="flex items-center gap-2 mt-0.5">
                        <button
                          onClick={() => {
                            const prev = activeClipIdx - 1;
                            if (prev >= 0) { setActiveClipIdx(prev); setPlaybackSec(0); setRecordedUrl(recordedClips[prev].url); }
                          }}
                          disabled={activeClipIdx === 0}
                          className="flex items-center gap-1 px-2.5 py-1 rounded border border-white/[0.08] text-[9px] text-slate-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          ← Earlier
                        </button>
                        <span className="text-[9px] text-slate-600 flex-1 text-center">
                          {activeClipIdx + 1} / {recordedClips.length}
                        </span>
                        <button
                          onClick={() => {
                            const next = activeClipIdx + 1;
                            if (next < recordedClips.length) { setActiveClipIdx(next); setPlaybackSec(0); setRecordedUrl(recordedClips[next].url); }
                          }}
                          disabled={activeClipIdx === recordedClips.length - 1}
                          className="flex items-center gap-1 px-2.5 py-1 rounded border border-white/[0.08] text-[9px] text-slate-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Later →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* RIGHT: Raise alarm + Door access + Camera notes */}
          <div className="w-[280px] shrink-0 flex flex-col">

            {/* ── Raise Alarm ── */}
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Raise Alarm</span>
            </div>
            <div className="px-4 py-3 border-b border-white/[0.06] flex flex-col gap-2.5">
              {/* Persistent confirmation — clears on page refresh */}
              {alarmRaised && (
                <div className="flex items-center gap-2 py-2 px-3 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  Alarm raised — dispatching to queue
                </div>
              )}
              {!raiseAlarmOpen ? (
                <button
                  onClick={() => setRaiseAlarmOpen(true)}
                  className="flex items-center justify-center gap-2 w-full py-2 rounded border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] font-semibold transition-all"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  {alarmRaised ? 'Raise Another Alarm' : 'Raise Alarm'}
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  {/* Reason — pick first; priority auto-fills below */}
                  <select
                    value={alarmReason}
                    onChange={e => {
                      const reason = e.target.value;
                      setAlarmReason(reason);
                      if (reason && REASON_PRIORITY[reason]) setAlarmPriority(REASON_PRIORITY[reason]);
                    }}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2.5 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-red-500/50 [color-scheme:dark]"
                  >
                    <option value="">— Select reason —</option>
                    <optgroup label="P1 — Threats">
                      <option value="Intrusion Detected">Intrusion Detected</option>
                      <option value="Suspicious Person">Suspicious Person</option>
                      <option value="Fight / Altercation">Fight / Altercation</option>
                      <option value="Weapon Observed">Weapon Observed</option>
                      <option value="Fire / Smoke">Fire / Smoke</option>
                      <option value="Vandalism in Progress">Vandalism in Progress</option>
                    </optgroup>
                    <optgroup label="P2 — Security">
                      <option value="Loitering">Loitering</option>
                      <option value="Unauthorized Access">Unauthorized Access</option>
                      <option value="Gate Left Open">Gate Left Open</option>
                      <option value="Vehicle Blocking">Vehicle Blocking</option>
                      <option value="Package / Object Left">Package / Object Left</option>
                    </optgroup>
                    <optgroup label="P3 — General">
                      <option value="Motion Detected">Motion Detected</option>
                      <option value="Noise Complaint">Noise Complaint</option>
                      <option value="Welfare Check">Welfare Check</option>
                      <option value="Other">Other</option>
                    </optgroup>
                  </select>
                  {/* Priority — auto-filled from reason, click to override */}
                  <div>
                    <p className="text-[9px] text-slate-600 mb-1 uppercase tracking-wider">
                      Priority
                      {alarmReason && REASON_PRIORITY[alarmReason] && alarmPriority !== REASON_PRIORITY[alarmReason] && (
                        <span className="ml-1.5 text-amber-500">· overridden</span>
                      )}
                    </p>
                    <div className="grid grid-cols-3 gap-1">
                      {(['P1','P2','P3'] as const).map(p => (
                        <button
                          key={p}
                          onClick={() => setAlarmPriority(p)}
                          className={`py-1.5 rounded border text-[10px] font-semibold transition-all ${
                            alarmPriority === p
                              ? p === 'P1' ? 'bg-red-600/30 border-red-500/50 text-red-300'
                                : p === 'P2' ? 'bg-amber-600/30 border-amber-500/50 text-amber-300'
                                : 'bg-slate-600/30 border-slate-500/50 text-slate-300'
                              : 'bg-white/[0.03] border-white/[0.06] text-slate-600 hover:text-slate-400'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Notes */}
                  <textarea
                    value={alarmNotes}
                    onChange={e => setAlarmNotes(e.target.value)}
                    placeholder="Optional notes..."
                    rows={2}
                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded px-2.5 py-1.5 text-[11px] text-slate-300 placeholder-slate-600 resize-none focus:outline-none focus:border-red-500/40"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={raiseAlarm}
                      disabled={alarmRaising || !alarmReason}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded border border-red-500/40 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-[11px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {alarmRaising
                        ? <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                        : null}
                      {alarmRaising ? 'Raising…' : 'Confirm Alarm'}
                    </button>
                    <button
                      onClick={() => setRaiseAlarmOpen(false)}
                      className="px-3 py-2 rounded border border-white/[0.08] text-slate-500 text-[11px] hover:text-slate-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Door Access ── */}
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Door Access</span>
            </div>
            <div className="px-4 py-4 border-b border-white/[0.06] flex flex-col gap-2.5">
              {availableDoors.length === 0 ? (
                <p className="text-[10px] text-slate-600 leading-relaxed">
                  No doors configured for this site. Add them in Setup → Brivo.
                </p>
              ) : (
                <>
                  <label className="text-[9px] text-slate-500 uppercase tracking-wider">Linked Door</label>
                  <select
                    value={linkedDoorId}
                    onChange={e => linkDoor(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2.5 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500/50 [color-scheme:dark]"
                  >
                    <option value="">— No door linked —</option>
                    {availableDoors.map(door => (
                      <option key={door.id} value={door.id}>{door.name}</option>
                    ))}
                  </select>

                  {linkedDoorId && (
                    <button
                      onClick={openDoor}
                      disabled={doorOpening}
                      className={`flex items-center justify-center gap-2 w-full py-2 rounded border text-[11px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                        doorOpened
                          ? 'bg-emerald-600/20 border-emerald-500/30 text-emerald-400'
                          : 'bg-indigo-600/20 hover:bg-indigo-600/40 border-indigo-500/30 text-indigo-300'
                      }`}
                    >
                      {doorOpening ? (
                        <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <div className="w-3.5 h-3.5"><Ic.Unlock /></div>
                      )}
                      {doorOpening
                        ? 'Opening…'
                        : doorOpened
                          ? `✓ ${availableDoors.find(d => d.id === linkedDoorId)?.name ?? 'Door'} Opened`
                          : `Open ${availableDoors.find(d => d.id === linkedDoorId)?.name ?? 'Door'}`
                      }
                    </button>
                  )}

                  {doorError && (
                    <p className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5">
                      ✗ {doorError}
                    </p>
                  )}

                  {/* ── Hold Open ── */}
                  {linkedDoorId && (
                    <div className="mt-1 pt-3 border-t border-white/[0.06] flex flex-col gap-2">
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider">Hold Open</span>

                      {holdActive ? (
                        /* Active hold — show status + release */
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2 px-2.5 py-2 rounded bg-amber-500/10 border border-amber-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                            <span className="text-[10px] text-amber-300 leading-snug">
                              {holdActiveUntil
                                ? `Held open until ${new Date(holdActiveUntil).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}`
                                : 'Held open indefinitely'}
                            </span>
                          </div>
                          <button
                            onClick={releaseHold}
                            disabled={holdReleasing}
                            className="flex items-center justify-center gap-2 w-full py-2 rounded border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] font-semibold transition-all disabled:opacity-40"
                          >
                            {holdReleasing
                              ? <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                              : null}
                            {holdReleasing ? 'Releasing…' : 'Release Hold'}
                          </button>
                        </div>
                      ) : (
                        /* Hold config */
                        <div className="flex flex-col gap-2">
                          {/* Mode toggle */}
                          <div className="grid grid-cols-2 gap-1.5">
                            {(['indefinite', 'until_time'] as const).map(m => (
                              <button
                                key={m}
                                onClick={() => setHoldMode(m)}
                                className={`py-1.5 rounded border text-[10px] font-medium transition-all ${
                                  holdMode === m
                                    ? 'bg-indigo-600/30 border-indigo-500/40 text-indigo-300'
                                    : 'bg-white/[0.03] border-white/[0.06] text-slate-500 hover:text-slate-300'
                                }`}
                              >
                                {m === 'indefinite' ? 'Indefinite' : 'Until Time'}
                              </button>
                            ))}
                          </div>

                          {/* End time picker */}
                          {holdMode === 'until_time' && (
                            <input
                              type="datetime-local"
                              value={holdEndTime}
                              onChange={e => setHoldEndTime(e.target.value)}
                              className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2.5 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500/50 [color-scheme:dark]"
                            />
                          )}

                          <button
                            onClick={holdOpen}
                            disabled={holdSetting || (holdMode === 'until_time' && !holdEndTime)}
                            className="flex items-center justify-center gap-2 w-full py-2 rounded border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[11px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {holdSetting
                              ? <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                              : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
                            }
                            {holdSetting ? 'Setting Hold…' : 'Hold Open'}
                          </button>
                        </div>
                      )}

                      {holdError && (
                        <p className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5">
                          ✗ {holdError}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── Camera Notes ── */}
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
                      <p className="text-[10px] text-slate-300 leading-relaxed">
                        {(() => { try { return JSON.parse(note.details).note ?? note.details; } catch { return note.details; } })()}
                      </p>
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
