"use client";

// FILE: app/alarms/page.tsx
// GateGuard 5.0 — Alarms / Dispatch Page
// 3-column full-height SOC dispatch interface:
//   LEFT  (300px) — Event Queue (Supabase realtime, P1-P4 priority)
//   CENTER (flex) — Action Canvas (dual video + tabs)
//   RIGHT (340px) — Command Panel (Brivo doors, AI steps, contacts, checklist, resolve)

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { createClient } from '@supabase/supabase-js';
import SmartVideoPlayer from '@/components/SmartVideoPlayer';

// ─── Supabase client ─────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Types ────────────────────────────────────────────────────────────────────
type Priority = 'P1' | 'P2' | 'P3' | 'P4';
type AlarmStatus = 'pending' | 'processing' | 'resolved';
type ActionTaken = 'authorized' | 'unauthorized' | 'false_alarm' | 'police_dispatched' | 'other' | '';

interface Alarm {
  id:          string;
  priority:    Priority;
  event_type:  string;
  event_label: string;
  site_name:   string;
  camera_id:   string | null;
  zone_id:     string | null;
  account_id:  string | null;
  source:      'brivo' | 'een';
  status:      AlarmStatus;
  created_at:  string;
  cameras?: {
    name: string;
    brivo_camera_id: string | null;
    een_camera_id: string | null;
  } | null;
  zones?: {
    name: string;
    account_id: string;
  } | null;
}

interface Door {
  id:      string;
  brivoId: string;
  name:    string;
  type:    string;
  status:  string;
}

interface Contact {
  id:       string;
  name:     string;
  role:     string;
  phone:    string | null;
  email:    string | null;
  priority: number;
}

interface ProcedureStep {
  order: number;
  text:  string;
}

interface SiteCameraEntry {
  id:              string;
  name:            string;
  brivo_camera_id: string | null;
  een_camera_id:   string | null;
  source:          string;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; ring: string; bg: string; dot: string }> = {
  P1: { label: 'P1', color: 'text-red-400',    ring: 'ring-red-500/60',    bg: 'bg-red-500/10',    dot: 'bg-red-500' },
  P2: { label: 'P2', color: 'text-orange-400', ring: 'ring-orange-500/60', bg: 'bg-orange-500/10', dot: 'bg-orange-500' },
  P3: { label: 'P3', color: 'text-yellow-400', ring: 'ring-yellow-500/60', bg: 'bg-yellow-500/10', dot: 'bg-yellow-500' },
  P4: { label: 'P4', color: 'text-emerald-400',ring: 'ring-emerald-500/60',bg: 'bg-emerald-500/10',dot: 'bg-emerald-500' },
};

const ROLE_COLORS: Record<string, string> = {
  police:           'bg-blue-500/20 text-blue-300 border-blue-500/30',
  fire:             'bg-red-500/20 text-red-300 border-red-500/30',
  property_manager: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  courtesy_officer: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  custom:           'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

const CLEARANCE_STEPS = [
  'Visual verification of event on live feed',
  'Credentials and authorization check',
  'Audio announcement performed',
];

const ACTION_OPTIONS: { value: ActionTaken; label: string }[] = [
  { value: '',                 label: 'Select action taken...' },
  { value: 'authorized',       label: 'Access Authorized' },
  { value: 'unauthorized',     label: 'Unauthorized Activity' },
  { value: 'false_alarm',      label: 'False Alarm' },
  { value: 'police_dispatched',label: 'Police Dispatched' },
  { value: 'other',            label: 'Other' },
];

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const Ic = {
  Shield: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75" />
    </svg>
  ),
  Bell: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
  ),
  Lock: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  ),
  Unlock: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 0 1 4.5-4.5 4.5 4.5 0 0 1 4.5 4.5v1.5M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  ),
  Phone: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  ),
  Camera: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5 20.47 5.78A.75.75 0 0 1 21.75 6v12a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  ),
  ClipboardList: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4" />
    </svg>
  ),
  Users: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  ),
  Document: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  ),
  ChevronRight: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  ),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)  return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PriorityBadge({ p }: { p: Priority }) {
  const cfg = PRIORITY_CONFIG[p];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider border ${cfg.bg} ${cfg.color} border-current/30`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <div className="w-3.5 h-3.5 text-slate-500 shrink-0">{icon}</div>
      <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-[0.12em]">{label}</span>
      <div className="flex-1 h-px bg-white/[0.06]" />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AlarmsPage() {
  // Queue state
  const [queue, setQueue]             = useState<Alarm[]>([]);
  const [activeAlarm, setActiveAlarm] = useState<Alarm | null>(null);
  const audioRef                      = useRef<HTMLAudioElement | null>(null);
  const prevCountRef                  = useRef(0);

  // Command panel state
  const [doors, setDoors]             = useState<Door[]>([]);
  const [contacts, setContacts]       = useState<Contact[]>([]);
  const [procedure, setProcedure]     = useState<ProcedureStep[]>([]);
  const [procedureTitle, setProcedureTitle] = useState('Response Protocol');
  const [doorsLoading, setDoorsLoading]     = useState(false);
  const [doorOpeningId, setDoorOpeningId]   = useState<string | null>(null);
  const [doorOpenedId, setDoorOpenedId]     = useState<string | null>(null);

  // Checklist state
  const [procedureChecked, setProcedureChecked]   = useState<boolean[]>([]);
  const [clearanceChecked, setClearanceChecked]   = useState([false, false, false]);

  // Action canvas state
  const [activeTab, setActiveTab]     = useState<'cameras' | 'history' | 'notes'>('cameras');
  const [siteCameras, setSiteCameras] = useState<SiteCameraEntry[]>([]);
  const [history, setHistory]         = useState<any[]>([]);
  const [notes, setNotes]             = useState('');
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);

  // Video panel state
  // preAlarmUrl: undefined = fetching, null = no clip found, string = URL ready
  const [preAlarmUrl, setPreAlarmUrl]     = useState<string | null | undefined>(undefined);
  const [liveOffset, setLiveOffset]       = useState<number>(0);   // 0 = live, negative = minutes ago
  const [liveOffsetUrl, setLiveOffsetUrl] = useState<string | null>(null);
  const [fetchingClip, setFetchingClip]   = useState(false);
  const preAlarmRef                       = useRef<HTMLDivElement>(null);
  const liveRef                           = useRef<HTMLDivElement>(null);

  // Resolve state
  const [actionTaken, setActionTaken]   = useState<ActionTaken>('');
  const [resolving, setResolving]       = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // ── Supabase realtime subscription ─────────────────────────────────────────
  useEffect(() => {
    // Initial load
    fetchQueue();

    const channel = supabase
      .channel('alarms-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alarms' },
        () => fetchQueue()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchQueue() {
    const { data } = await supabase
      .from('alarms')
      .select(`
        *,
        cameras ( name, brivo_camera_id, een_camera_id, source ),
        zones ( name, account_id )
      `)
      .eq('status', 'pending')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(50);

    if (data) {
      setQueue(data as Alarm[]);

      // Audio alert when new P1 alarms arrive
      if (data.length > prevCountRef.current && data.some(a => a.priority === 'P1')) {
        audioRef.current?.play().catch(() => {});
      }
      prevCountRef.current = data.length;
    }
  }

  // ── Load alarm into Action Canvas ──────────────────────────────────────────
  const processAlarm = useCallback(async (alarm: Alarm) => {
    setActiveAlarm(alarm);
    setActiveTab('cameras');
    setNotes(`Event: ${alarm.event_label}\nSite: ${alarm.site_name}\nTime: ${fmtTime(alarm.created_at)}\n\n`);
    setActionTaken('');
    setResolveError(null);
    setProcedureChecked([]);
    setClearanceChecked([false, false, false]);
    setPreAlarmUrl(undefined);   // undefined = currently fetching
    setLiveOffset(0);
    setLiveOffsetUrl(null);

    const accountId = alarm.account_id ?? alarm.zones?.account_id;
    const zoneId    = alarm.zone_id;

    // Set initial live camera
    const camId = alarm.cameras?.brivo_camera_id ?? alarm.cameras?.een_camera_id ?? null;
    setActiveCameraId(camId);

    // Load doors
    if (accountId) {
      setDoorsLoading(true);
      try {
        const res  = await fetch('/api/brivo/doors', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ accountId, zoneId }),
        });
        const data = await res.json();
        setDoors(data.doors ?? []);
      } catch {
        setDoors([]);
      } finally {
        setDoorsLoading(false);
      }
    }

    // Load contacts
    if (zoneId) {
      const { data: contactRows } = await supabase
        .from('contacts')
        .select('*')
        .eq('zone_id', zoneId)
        .order('priority', { ascending: true });
      setContacts(contactRows ?? []);
    }

    // Load procedure
    if (zoneId) {
      const eventType = alarm.event_type?.toLowerCase()
        .replace('video_analytics_', '') // strip Brivo prefix
        .replace(/ /g, '_');

      const { data: proc } = await supabase
        .from('procedures')
        .select('*')
        .eq('zone_id', zoneId)
        .or(`event_type.eq.${eventType},event_type.eq.default`)
        .order('event_type', { ascending: false }) // prefer specific over default
        .limit(1)
        .maybeSingle();

      if (proc) {
        setProcedure(proc.steps ?? []);
        setProcedureTitle(proc.title);
        setProcedureChecked(new Array((proc.steps ?? []).length).fill(false));
      } else {
        setProcedure([]);
        setProcedureTitle('Response Protocol');
      }
    }

    // Load site cameras
    if (zoneId) {
      const { data: cams } = await supabase
        .from('cameras')
        .select('id, name, brivo_camera_id, een_camera_id, source')
        .eq('zone_id', zoneId)
        .eq('is_monitored', true)
        .limit(12);
      setSiteCameras(cams ?? []);
    }

    // Load event history
    if (zoneId) {
      const { data: hist } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('zone_id', zoneId)
        .order('created_at', { ascending: false })
        .limit(10);
      setHistory(hist ?? []);
    }

    // Fetch pre-alarm recorded clip (60s before → 30s after event)
    const eenCamId = alarm.cameras?.een_camera_id;
    if (eenCamId && alarm.account_id) {
      try {
        const alarmMs   = new Date(alarm.created_at).getTime();
        const startTime = new Date(alarmMs - 60_000).toISOString();
        const endTime   = new Date(alarmMs + 30_000).toISOString();
        const clipRes   = await fetch('/api/een/recorded', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            accountId: alarm.account_id,
            cameraId:  eenCamId,
            startTime,
            endTime,
          }),
        });
        if (clipRes.ok) {
          const clipData = await clipRes.json();
          setPreAlarmUrl(clipData.url ?? null);  // null = no clip in that window
        } else {
          setPreAlarmUrl(null);  // null = no clip
        }
      } catch {
        setPreAlarmUrl(null);  // null = no clip (error)
      }
    }

    // Mark alarm as processing
    await supabase
      .from('alarms')
      .update({ status: 'processing' })
      .eq('id', alarm.id);
  }, []);

  // ── Quick dismiss (Nothing Seen / False Alarm) ────────────────────────────
  const dismissAlarm = useCallback(async (reason: 'nothing_seen' | 'false_alarm') => {
    if (!activeAlarm) return;
    const accountId = activeAlarm.account_id ?? activeAlarm.zones?.account_id;
    await supabase.from('alarms').update({ status: 'resolved' }).eq('id', activeAlarm.id);
    await supabase.from('audit_logs').insert({
      account_id:  accountId,
      alarm_id:    activeAlarm.id,
      zone_id:     activeAlarm.zone_id,
      operator_id: 'operator-1',
      action:      'alarm_dismissed',
      details:     JSON.stringify({ reason }),
      created_at:  new Date().toISOString(),
    });
    setActiveAlarm(null);
    setDoors([]);
    setContacts([]);
    setProcedure([]);
    setSiteCameras([]);
    setHistory([]);
    setPreAlarmUrl(undefined);
    setLiveOffset(0);
    setLiveOffsetUrl(null);
  }, [activeAlarm]);

  // ── Fetch offset clip for live panel time nav ──────────────────────────────
  const fetchOffsetClip = useCallback(async (offsetMinutes: number) => {
    if (!activeAlarm) return;
    if (offsetMinutes === 0) {
      setLiveOffset(0);
      setLiveOffsetUrl(null);
      return;
    }
    setFetchingClip(true);
    const eenCamId  = activeAlarm.cameras?.een_camera_id;
    const accountId = activeAlarm.account_id;
    if (!eenCamId || !accountId) { setFetchingClip(false); return; }

    const now       = Date.now();
    const startTime = new Date(now + offsetMinutes * 60_000).toISOString();
    const endTime   = new Date(now + offsetMinutes * 60_000 + 120_000).toISOString();
    try {
      const res = await fetch('/api/een/recorded', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ accountId, cameraId: eenCamId, startTime, endTime }),
      });
      if (res.ok) {
        const data = await res.json();
        setLiveOffsetUrl(data.url ?? null);
        setLiveOffset(offsetMinutes);
      }
    } catch {}
    finally { setFetchingClip(false); }
  }, [activeAlarm]);

  // ── Open door ──────────────────────────────────────────────────────────────
  const openDoor = useCallback(async (door: Door) => {
    if (!activeAlarm) return;
    setDoorOpeningId(door.brivoId);
    const accountId = activeAlarm.account_id ?? activeAlarm.zones?.account_id;

    try {
      await fetch('/api/brivo/open', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          accountId,
          doorId:     door.brivoId,
          operatorId: 'operator-1',
          alarmId:    activeAlarm.id,
        }),
      });
      setDoorOpenedId(door.brivoId);
      setTimeout(() => setDoorOpenedId(null), 5000);
    } catch {}
    finally { setDoorOpeningId(null); }
  }, [activeAlarm]);

  // ── Resolve alarm ──────────────────────────────────────────────────────────
  const resolveAlarm = useCallback(async () => {
    if (!activeAlarm || !actionTaken) return;
    setResolving(true);
    setResolveError(null);

    try {
      const accountId = activeAlarm.account_id ?? activeAlarm.zones?.account_id;

      // 1. Update alarm status
      await supabase
        .from('alarms')
        .update({ status: 'resolved' })
        .eq('id', activeAlarm.id);

      // 2. Write audit log
      await supabase.from('audit_logs').insert({
        account_id:  accountId,
        alarm_id:    activeAlarm.id,
        zone_id:     activeAlarm.zone_id,
        operator_id: 'operator-1',
        action:      'alarm_resolved',
        details:     JSON.stringify({ actionTaken, notes }),
        created_at:  new Date().toISOString(),
      });

      // 3. Generate incident report
      await supabase.from('incident_reports').insert({
        alarm_id:      activeAlarm.id,
        zone_id:       activeAlarm.zone_id,
        camera_id:     activeAlarm.camera_id,
        operator_id:   'operator-1',
        operator_name: 'Operator',
        action_taken:  actionTaken,
        notes,
        report_type:   'incident',
        report_body:   buildReportText(activeAlarm, actionTaken, notes),
        generated_at:  new Date().toISOString(),
      });

      // 4. Clear active alarm
      setActiveAlarm(null);
      setDoors([]);
      setContacts([]);
      setProcedure([]);
      setSiteCameras([]);
      setHistory([]);
      setPreAlarmUrl(undefined);
      setLiveOffset(0);
      setLiveOffsetUrl(null);

    } catch (err: any) {
      setResolveError(err.message || 'Failed to resolve alarm');
    } finally {
      setResolving(false);
    }
  }, [activeAlarm, actionTaken, notes]);

  function buildReportText(alarm: Alarm, action: ActionTaken, n: string): string {
    return [
      `INCIDENT REPORT — GateGuard SOC`,
      `Generated: ${new Date().toLocaleString()}`,
      ``,
      `Event: ${alarm.event_label}`,
      `Priority: ${alarm.priority}`,
      `Site: ${alarm.site_name}`,
      `Time of Event: ${fmtTime(alarm.created_at)}`,
      ``,
      `Action Taken: ${ACTION_OPTIONS.find(a => a.value === action)?.label ?? action}`,
      ``,
      `Operator Notes:`,
      n,
    ].join('\n');
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const allClearanceChecked = clearanceChecked.every(Boolean);
  const canResolve = allClearanceChecked && actionTaken !== '';

  const activeCameraEntry = siteCameras.find(c =>
    c.brivo_camera_id === activeCameraId || c.een_camera_id === activeCameraId
  );
  const activeAccountId = activeAlarm?.account_id ?? activeAlarm?.zones?.account_id ?? '';
  // Default to 'een' (active integration). Brivo dormant until EEN is 100%.
  const activeCameraSource = (activeAlarm?.cameras as any)?.source ?? activeCameraEntry?.source ?? 'een';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full bg-[#030406] text-white overflow-hidden">
      {/* Hidden audio for alert */}
      <audio ref={audioRef} src="/alert.mp3" preload="auto" />

      {/* ── LEFT: Event Queue ───────────────────────────────────────────── */}
      <aside
        className={`
          w-[300px] shrink-0 flex flex-col border-r border-white/[0.06]
          ${queue.length > 0 && !activeAlarm ? 'ring-1 ring-red-500/40 animate-pulse-border' : ''}
        `}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 text-red-400"><Ic.Bell /></div>
            <span className="text-[11px] font-semibold text-white uppercase tracking-[0.12em]">
              Event Queue
            </span>
          </div>
          {queue.length > 0 && (
            <span className="flex items-center gap-1 bg-red-500/20 border border-red-500/30 rounded px-2 py-0.5 text-[10px] font-bold text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {queue.length}
            </span>
          )}
        </div>

        {/* Queue list */}
        <div className="flex-1 overflow-y-auto space-y-1 p-2">
          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-center px-4">
              <div className="w-8 h-8 text-slate-700"><Ic.Shield /></div>
              <p className="text-[10px] text-slate-600 uppercase tracking-wider">No pending events</p>
            </div>
          ) : (
            queue.map((alarm) => {
              const cfg = PRIORITY_CONFIG[alarm.priority];
              const isActive = activeAlarm?.id === alarm.id;
              return (
                <div
                  key={alarm.id}
                  className={`
                    rounded border p-2.5 transition-all cursor-default
                    ${isActive
                      ? `${cfg.bg} ${cfg.ring} ring-1 border-transparent`
                      : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                    }
                  `}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <PriorityBadge p={alarm.priority} />
                    <span className="text-[9px] text-slate-500">{timeAgo(alarm.created_at)}</span>
                  </div>
                  <p className="text-[11px] font-semibold text-white leading-tight mb-0.5 truncate">
                    {alarm.site_name}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate mb-1">
                    {alarm.event_label}
                  </p>
                  {alarm.cameras?.name && (
                    <p className="text-[9px] text-slate-600 truncate mb-2">
                      {alarm.cameras.name}
                    </p>
                  )}
                  {!isActive && (
                    <button
                      onClick={() => processAlarm(alarm)}
                      className="w-full mt-1 py-1 rounded text-[9px] font-semibold uppercase tracking-wider bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-300 transition-all"
                    >
                      Process
                    </button>
                  )}
                  {isActive && (
                    <div className="text-[9px] text-indigo-400 font-semibold uppercase tracking-wider text-center">
                      — Active —
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ── CENTER: Action Canvas ───────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 border-r border-white/[0.06]">
        {!activeAlarm ? (
          /* Idle state */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-14 h-14 text-slate-800"><Ic.Shield /></div>
            <div>
              <p className="text-[13px] font-semibold text-slate-600 uppercase tracking-wider">
                Awaiting Operator Action
              </p>
              <p className="text-[11px] text-slate-700 mt-1">
                Select an event from the queue to begin dispatch
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Alarm header bar */}
            <div className="px-4 py-2 border-b border-white/[0.06] flex items-center gap-3 bg-white/[0.01]">
              <PriorityBadge p={activeAlarm.priority} />
              <span className="text-[12px] font-semibold text-white">{activeAlarm.site_name}</span>
              <span className="text-[11px] text-slate-500">{activeAlarm.event_label}</span>
              <span className="text-[10px] text-slate-600 font-mono">{fmtTime(activeAlarm.created_at)}</span>
              {/* Quick dismiss actions */}
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  onClick={() => dismissAlarm('nothing_seen')}
                  className="px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-700/60 hover:bg-slate-600/60 border border-white/[0.08] text-slate-400 hover:text-slate-200 transition-all"
                  title="Mark as nothing seen and clear from queue"
                >
                  Nothing Seen
                </button>
                <button
                  onClick={() => dismissAlarm('false_alarm')}
                  className="px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-700/30 hover:bg-amber-600/40 border border-amber-500/20 text-amber-400 hover:text-amber-300 transition-all"
                  title="Mark as false alarm and clear from queue"
                >
                  False Alarm
                </button>
              </div>
            </div>

            {/* TOP 55%: Dual Video */}
            <div className="flex gap-px bg-black" style={{ height: '55%' }}>
              {/* Pre-alarm / Recorded */}
              <div
                ref={preAlarmRef}
                className="flex-1 relative cursor-pointer"
                onDoubleClick={() => preAlarmRef.current?.requestFullscreen?.()}
                title="Double-click for fullscreen"
              >
                <div className="absolute top-2 left-2 z-10 bg-amber-600/80 border border-amber-500/30 px-2 py-0.5 rounded text-[9px] font-bold text-white uppercase tracking-wider pointer-events-none">
                  Pre-Alarm Clip
                </div>
                <div className="absolute bottom-2 right-2 z-10 text-[8px] text-white/30 pointer-events-none">
                  ⤡ dbl-click fullscreen
                </div>
                {activeCameraId && typeof preAlarmUrl === 'string' ? (
                  /* Has a recorded URL — play it */
                  <SmartVideoPlayer
                    accountId={activeAccountId}
                    cameraId={activeCameraId}
                    source={activeCameraSource as 'brivo' | 'een'}
                    streamType="preview"
                    recordedUrl={preAlarmUrl}
                    label=""
                  />
                ) : activeCameraId && preAlarmUrl === undefined ? (
                  /* Still fetching */
                  <div className="w-full h-full flex flex-col items-center justify-center bg-black gap-2">
                    <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-[9px] text-amber-700">Fetching clip...</p>
                  </div>
                ) : activeCameraId ? (
                  /* null = no recording in that window */
                  <div className="w-full h-full flex items-center justify-center bg-black">
                    <p className="text-[10px] text-slate-600">No pre-alarm clip available</p>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-black">
                    <p className="text-[10px] text-slate-600">No camera assigned</p>
                  </div>
                )}
              </div>

              {/* Live feed */}
              <div
                ref={liveRef}
                className="flex-1 relative cursor-pointer"
                onDoubleClick={(e) => {
                  // Only fullscreen if clicking the container, not child buttons
                  if (e.target === liveRef.current || (e.target as HTMLElement).tagName !== 'BUTTON') {
                    liveRef.current?.requestFullscreen?.();
                  }
                }}
                title="Double-click for fullscreen"
              >
                {/* Live / offset label */}
                <div className="absolute top-2 left-2 z-10 flex items-center gap-1 pointer-events-none">
                  {liveOffset === 0 ? (
                    <span className="flex items-center gap-1 bg-red-600/80 border border-red-500/30 px-2 py-0.5 rounded text-[9px] font-bold text-white uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      Live
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 bg-slate-700/80 border border-slate-500/30 px-2 py-0.5 rounded text-[9px] font-bold text-slate-200 uppercase tracking-wider">
                      -{Math.abs(liveOffset)}m ago
                    </span>
                  )}
                </div>

                {/* Time navigation buttons */}
                <div className="absolute top-2 right-2 z-10 flex gap-1" onDoubleClick={e => e.stopPropagation()}>
                  {([0, -5, -15, -30] as const).map((offset) => (
                    <button
                      key={offset}
                      onClick={(e) => { e.stopPropagation(); fetchOffsetClip(offset); }}
                      disabled={fetchingClip}
                      className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border transition-all
                        ${liveOffset === offset
                          ? 'bg-indigo-600/80 border-indigo-500/60 text-white'
                          : 'bg-black/50 border-white/[0.12] text-slate-400 hover:text-white hover:border-white/30'
                        } ${fetchingClip ? 'opacity-40 cursor-wait' : ''}`}
                    >
                      {offset === 0 ? 'Live' : `${Math.abs(offset)}m`}
                    </button>
                  ))}
                </div>

                <div className="absolute bottom-2 right-2 z-10 text-[8px] text-white/30 pointer-events-none">
                  ⤡ dbl-click fullscreen
                </div>

                {activeCameraId ? (
                  liveOffset !== 0 && liveOffsetUrl ? (
                    <SmartVideoPlayer
                      accountId={activeAccountId}
                      cameraId={activeCameraId}
                      source={activeCameraSource as 'brivo' | 'een'}
                      streamType="main"
                      recordedUrl={liveOffsetUrl}
                      label=""
                    />
                  ) : (
                    <SmartVideoPlayer
                      accountId={activeAccountId}
                      cameraId={activeCameraId}
                      source={activeCameraSource as 'brivo' | 'een'}
                      streamType="main"
                      label=""
                    />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-black">
                    <p className="text-[10px] text-slate-600">No live feed available</p>
                  </div>
                )}
              </div>
            </div>

            {/* BOTTOM 45%: Tabs */}
            <div className="flex-1 flex flex-col min-h-0">
              {/* Tab bar */}
              <div className="flex border-b border-white/[0.06] px-2 pt-1 gap-1">
                {(['cameras', 'history', 'notes'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider rounded-t transition-all ${
                      activeTab === tab
                        ? 'text-white border-b-2 border-indigo-500'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {tab === 'cameras' ? 'Site Cameras' : tab === 'history' ? 'Event History' : 'Operator Notes'}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto p-3">
                {/* Site Cameras */}
                {activeTab === 'cameras' && (
                  <div className="grid grid-cols-4 gap-1.5">
                    {siteCameras.map((cam) => {
                      const camId = cam.brivo_camera_id ?? cam.een_camera_id ?? '';
                      const isSelected = camId === activeCameraId;
                      return (
                        <div
                          key={cam.id}
                          onClick={() => setActiveCameraId(camId)}
                          className={`
                            relative aspect-video rounded overflow-hidden cursor-pointer
                            border transition-all
                            ${isSelected
                              ? 'border-indigo-500 ring-1 ring-indigo-500/40'
                              : 'border-white/[0.06] hover:border-white/20'
                            }
                          `}
                        >
                          <SmartVideoPlayer
                            accountId={activeAccountId}
                            cameraId={camId}
                            source={cam.source as 'brivo' | 'een'}
                            streamType="preview"
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-0.5">
                            <p className="text-[8px] text-white truncate">{cam.name}</p>
                          </div>
                        </div>
                      );
                    })}
                    {siteCameras.length === 0 && (
                      <div className="col-span-4 py-6 text-center text-[10px] text-slate-600">
                        No cameras configured for this site
                      </div>
                    )}
                  </div>
                )}

                {/* Event History */}
                {activeTab === 'history' && (
                  <div className="space-y-1.5">
                    {history.map((h, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 px-2.5 py-2 rounded bg-white/[0.02] border border-white/[0.05]"
                      >
                        <div className="w-1 h-1 rounded-full bg-slate-600 mt-1.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-slate-300 truncate">{h.action ?? h.details}</p>
                          <p className="text-[9px] text-slate-600 mt-0.5">{fmtTime(h.created_at)}</p>
                        </div>
                      </div>
                    ))}
                    {history.length === 0 && (
                      <p className="text-center text-[10px] text-slate-600 py-6">No event history for this site</p>
                    )}
                  </div>
                )}

                {/* Operator Notes */}
                {activeTab === 'notes' && (
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Add operator notes..."
                    className="w-full h-full min-h-[120px] bg-white/[0.02] border border-white/[0.06] rounded px-3 py-2 text-[11px] text-slate-300 placeholder-slate-600 resize-none focus:outline-none focus:border-indigo-500/50"
                  />
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* ── RIGHT: Command Panel ────────────────────────────────────────── */}
      <aside className="w-[340px] shrink-0 flex flex-col overflow-y-auto">
        <div className="flex-1 space-y-4 p-3">

          {/* ── 1. Brivo Access Control ── */}
          <section>
            <SectionHeader icon={<Ic.Lock />} label="Brivo Access Control" />
            {!activeAlarm ? (
              <p className="text-[10px] text-slate-600 text-center py-3">Awaiting alarm</p>
            ) : doorsLoading ? (
              <div className="flex justify-center py-3">
                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : doors.length === 0 ? (
              <p className="text-[10px] text-slate-600 text-center py-3">No doors configured for this site</p>
            ) : (
              <div className="space-y-1.5">
                {doors.map((door) => {
                  const isOpening = doorOpeningId === door.brivoId;
                  const isOpen    = doorOpenedId   === door.brivoId;
                  return (
                    <div
                      key={door.id}
                      className={`flex items-center justify-between px-2.5 py-2 rounded border transition-all
                        ${isOpen
                          ? 'border-emerald-500/40 bg-emerald-500/10'
                          : 'border-white/[0.06] bg-white/[0.02]'
                        }
                      `}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-3.5 h-3.5 shrink-0 ${isOpen ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {isOpen ? <Ic.Unlock /> : <Ic.Lock />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold text-white truncate">{door.name}</p>
                          <p className="text-[9px] text-slate-500 capitalize">{door.type}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => openDoor(door)}
                        disabled={isOpening || isOpen}
                        className={`shrink-0 ml-2 px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all
                          ${isOpen
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default'
                            : isOpening
                              ? 'bg-white/[0.05] text-slate-500 border border-white/[0.06] cursor-wait'
                              : 'bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30'
                          }`}
                      >
                        {isOpen ? 'Open' : isOpening ? '...' : 'Open'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── 2. AI Recommended Steps ── */}
          <section>
            <SectionHeader icon={<Ic.ClipboardList />} label="AI Recommended Steps" />
            {procedure.length === 0 ? (
              <p className="text-[10px] text-slate-600 text-center py-3">
                {activeAlarm ? 'No procedure configured for this event type' : 'Awaiting alarm'}
              </p>
            ) : (
              <div className="space-y-1">
                <p className="text-[9px] text-slate-500 mb-2">{procedureTitle}</p>
                {procedure.map((step, i) => (
                  <label
                    key={i}
                    className={`flex items-start gap-2.5 px-2 py-1.5 rounded cursor-pointer transition-all
                      ${procedureChecked[i] ? 'opacity-50' : 'hover:bg-white/[0.02]'}`}
                  >
                    <button
                      onClick={() => {
                        const next = [...procedureChecked];
                        next[i] = !next[i];
                        setProcedureChecked(next);
                      }}
                      className={`shrink-0 mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center transition-all
                        ${procedureChecked[i]
                          ? 'bg-indigo-600 border-indigo-600'
                          : 'border-white/20 bg-transparent hover:border-indigo-500/50'
                        }`}
                    >
                      {procedureChecked[i] && (
                        <div className="w-2 h-2 text-white"><Ic.Check /></div>
                      )}
                    </button>
                    <span className={`text-[10px] leading-relaxed ${procedureChecked[i] ? 'line-through text-slate-600' : 'text-slate-300'}`}>
                      {step.text}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </section>

          {/* ── 3. Emergency Contacts ── */}
          <section>
            <SectionHeader icon={<Ic.Users />} label="Emergency Contacts" />
            {contacts.length === 0 ? (
              <p className="text-[10px] text-slate-600 text-center py-3">
                {activeAlarm ? 'No contacts configured for this site' : 'Awaiting alarm'}
              </p>
            ) : (
              <div className="space-y-1.5">
                {contacts.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between px-2.5 py-2 rounded border border-white/[0.06] bg-white/[0.02]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${ROLE_COLORS[c.role] ?? ROLE_COLORS.custom}`}>
                          {c.role.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-[10px] font-semibold text-white truncate">{c.name}</p>
                      {c.phone && (
                        <p className="text-[9px] text-slate-500 font-mono">{c.phone}</p>
                      )}
                    </div>
                    {c.phone && (
                      <a
                        href={`tel:${c.phone}`}
                        className="shrink-0 ml-2 w-7 h-7 flex items-center justify-center rounded border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] text-slate-400 hover:text-white transition-all"
                      >
                        <div className="w-3.5 h-3.5"><Ic.Phone /></div>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── 4. Clearance Protocol ── */}
          <section>
            <SectionHeader icon={<Ic.Shield />} label="Clearance Protocol" />
            <div className="space-y-1">
              {CLEARANCE_STEPS.map((step, i) => (
                <label
                  key={i}
                  className={`flex items-start gap-2.5 px-2 py-1.5 rounded cursor-pointer transition-all
                    ${clearanceChecked[i] ? 'opacity-50' : 'hover:bg-white/[0.02]'}`}
                >
                  <button
                    onClick={() => {
                      const next = [...clearanceChecked];
                      next[i] = !next[i];
                      setClearanceChecked(next);
                    }}
                    disabled={!activeAlarm}
                    className={`shrink-0 mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center transition-all
                      ${clearanceChecked[i]
                        ? 'bg-emerald-600 border-emerald-600'
                        : activeAlarm
                          ? 'border-white/20 bg-transparent hover:border-emerald-500/50'
                          : 'border-white/10 bg-transparent opacity-30 cursor-not-allowed'
                      }`}
                  >
                    {clearanceChecked[i] && (
                      <div className="w-2 h-2 text-white"><Ic.Check /></div>
                    )}
                  </button>
                  <span className={`text-[10px] leading-relaxed ${clearanceChecked[i] ? 'line-through text-slate-600' : 'text-slate-300'}`}>
                    {step}
                  </span>
                </label>
              ))}
            </div>
          </section>

          {/* ── 5. Resolve & Generate Report ── */}
          <section className="border-t border-white/[0.06] pt-4">
            <SectionHeader icon={<Ic.Document />} label="Resolve & Report" />

            <div className="space-y-2">
              <select
                value={actionTaken}
                onChange={e => setActionTaken(e.target.value as ActionTaken)}
                disabled={!activeAlarm}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2.5 py-2 text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500/50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {ACTION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              {resolveError && (
                <p className="text-[9px] text-red-400 px-1">{resolveError}</p>
              )}

              {!allClearanceChecked && activeAlarm && (
                <p className="text-[9px] text-slate-600 px-1">
                  Complete all clearance protocol steps to enable resolve
                </p>
              )}

              <button
                onClick={resolveAlarm}
                disabled={!canResolve || resolving || !activeAlarm}
                className={`
                  w-full py-2.5 rounded font-semibold text-[11px] uppercase tracking-wider transition-all
                  ${canResolve && !resolving && activeAlarm
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/30'
                    : 'bg-white/[0.04] text-slate-600 border border-white/[0.06] cursor-not-allowed'
                  }
                `}
              >
                {resolving ? 'Resolving...' : 'Resolve & Generate Report'}
              </button>
            </div>
          </section>

        </div>
      </aside>
    </div>
  );
}
