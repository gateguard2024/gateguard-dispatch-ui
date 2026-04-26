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
type TabName = 'cameras' | 'history' | 'scripts' | 'notes';

interface TriageResult {
  decision:        'auto_dismiss' | 'route_to_human' | 'escalate' | string;
  priority:        string;
  interpretation:  string;
  suggested_steps: string[];
  confidence:      number;
  reasoning:       string;
  model:           string;
  processed_at:    string;
}

interface Alarm {
  id:             string;
  priority:       Priority;
  event_type:     string;
  event_label:    string;
  site_name:      string;
  camera_id:      string | null;
  zone_id:        string | null;
  account_id:     string | null;
  source:         'brivo' | 'een';
  status:         AlarmStatus;
  created_at:     string;
  triage_status?: string | null;
  triage_result?: TriageResult | null;
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

function SectionHeader({ icon, label, action }: { icon: React.ReactNode; label: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <div className="w-3.5 h-3.5 text-slate-400 shrink-0">{icon}</div>
      <span className="text-[9px] font-semibold text-slate-300 uppercase tracking-[0.12em]">{label}</span>
      <div className="flex-1 h-px bg-white/[0.08]" />
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function ScriptCard({ label, color, text }: { label: string; color: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className={`rounded border ${color} p-2.5`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
        <button
          onClick={copy}
          className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-slate-400 hover:text-white transition-all"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <p className="text-[10px] text-slate-300 leading-relaxed">{text}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AlarmsPage() {
  // Queue state
  const [queue, setQueue]             = useState<Alarm[]>([]);
  const [activeAlarm, setActiveAlarm] = useState<Alarm | null>(null);
  const audioRef                      = useRef<AudioContext | null>(null);

  // Play a sharp alert tone using Web Audio API — no file needed
  const playAlertTone = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioRef.current = ctx;
      // Two short beeps
      [0, 0.3].forEach((startTime) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.4, ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + 0.2);
        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + 0.2);
      });
    } catch (_) {}
  }, []);
  const prevCountRef                  = useRef(0);

  // Command panel state
  const [doors, setDoors]             = useState<Door[]>([]);
  const [contacts, setContacts]       = useState<Contact[]>([]);
  const [procedure, setProcedure]     = useState<ProcedureStep[]>([]);
  const [procedureTitle, setProcedureTitle] = useState('Response Protocol');
  const [doorsLoading, setDoorsLoading]     = useState(false);
  const [doorOpeningId, setDoorOpeningId]   = useState<string | null>(null);
  const [doorOpenedId, setDoorOpenedId]     = useState<string | null>(null);

  // Hold open state
  const [holdExpandedId, setHoldExpandedId]   = useState<string | null>(null); // brivoId of door showing hold config
  const [holdMode, setHoldMode]               = useState<'indefinite' | 'until_time'>('indefinite');
  const [holdEndTime, setHoldEndTime]         = useState('');
  const [holdActiveIds, setHoldActiveIds]     = useState<Record<string, string | null>>({}); // brivoId → ISO until time (null = indefinite)
  const [holdSettingId, setHoldSettingId]     = useState<string | null>(null);
  const [holdReleasingId, setHoldReleasingId] = useState<string | null>(null);
  const [holdError, setHoldError]             = useState<string | null>(null);

  // Checklist state
  const [procedureChecked, setProcedureChecked]   = useState<boolean[]>([]);
  const [clearanceChecked, setClearanceChecked]   = useState([false, false, false]);

  // Action canvas state
  const [activeTab, setActiveTab]     = useState<TabName>('cameras');
  const [siteCameras, setSiteCameras] = useState<SiteCameraEntry[]>([]);
  const [history, setHistory]         = useState<any[]>([]);
  const [notes, setNotes]             = useState('');
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);

  // Video panel state
  // preAlarmUrl: undefined = fetching, null = no clip found, string = URL ready
  const [preAlarmUrl, setPreAlarmUrl]         = useState<string | null | undefined>(undefined);
  const [preAlarmToken, setPreAlarmToken]     = useState<string | null>(null);
  const [liveOffset, setLiveOffset]           = useState<number>(0);
  const [liveOffsetUrl, setLiveOffsetUrl]     = useState<string | null>(null);
  const [fetchingClip, setFetchingClip]       = useState(false);
  // expandedPanel: null = dual view, 'pre-alarm' | 'live' = that panel fills the top section
  const [expandedPanel, setExpandedPanel]     = useState<'pre-alarm' | 'live' | null>(null);
  // Resolved EEN camera ID — stored after processAlarm resolves it (avoids stale joins)
  const [resolvedEenCamId, setResolvedEenCamId] = useState<string | null>(null);
  // camerasView: 'grid' = thumbnail grid, 'list' = compact list
  const [camerasView, setCamerasView]         = useState<'grid' | 'list'>('list');
  // AI triage result for the active alarm
  const [triageResult, setTriageResult]       = useState<TriageResult | null>(null);
  // Procedure suggest state
  const [suggestingSteps, setSuggestingSteps] = useState(false);
  const [stepSuggestion, setStepSuggestion]   = useState<{ title: string; steps: ProcedureStep[]; reasoning: string } | null>(null);
  // Total alarm count (includes beyond the 50-item display limit)
  const [totalAlarmCount, setTotalAlarmCount] = useState(0);

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
    // Get total count of pending alarms (not limited to display window)
    const { count } = await supabase
      .from('alarms')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    setTotalAlarmCount(count ?? 0);

    const { data } = await supabase
      .from('alarms')
      .select(`
        *,
        cameras ( name, brivo_camera_id, een_camera_id, source ),
        zones ( name, account_id )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })   // newest first
      .limit(50);

    if (data) {
      setQueue(data as Alarm[]);
      // Audio alert when new P1 alarms arrive
      if (data.length > prevCountRef.current && data.some(a => a.priority === 'P1')) {
        playAlertTone();
      }
      prevCountRef.current = data.length;
    }
  }

  // ── Load alarm into Action Canvas ──────────────────────────────────────────
  const processAlarm = useCallback(async (alarm: Alarm) => {
    setActiveAlarm(alarm);
    setTriageResult(alarm.triage_result ?? null);  // load AI assessment immediately
    setActiveTab('cameras');
    setNotes(`Event: ${alarm.event_label}\nSite: ${alarm.site_name}\nTime: ${fmtTime(alarm.created_at)}\n\n`);
    setActionTaken('');
    setResolveError(null);
    setProcedureChecked([]);
    setClearanceChecked([false, false, false]);
    setPreAlarmUrl(undefined);   // undefined = currently fetching
    setPreAlarmToken(null);
    setTriageResult(null);
    setLiveOffset(0);
    setLiveOffsetUrl(null);
    setExpandedPanel(null);
    setResolvedEenCamId(null);
    setHoldExpandedId(null);
    setHoldActiveIds({});
    setHoldError(null);
    // Default hold end time: 2 hours from now
    const twoHours = new Date(Date.now() + 2 * 60 * 60_000);
    setHoldEndTime(twoHours.toISOString().slice(0, 16));

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

    // Load event history — show recent resolved/dismissed alarms for this zone
    if (zoneId) {
      const { data: hist } = await supabase
        .from('alarms')
        .select('id, priority, event_label, status, created_at, cameras(name)')
        .eq('zone_id', zoneId)
        .in('status', ['resolved'])
        .order('created_at', { ascending: false })
        .limit(20);
      setHistory(hist ?? []);
    }

    // Resolve EEN camera ESN — try join first, then direct lookup
    let eenCamId = alarm.cameras?.een_camera_id ?? null;
    const accountId2 = alarm.account_id;

    if (!eenCamId && alarm.camera_id) {
      const { data: camRow } = await supabase
        .from('cameras')
        .select('een_camera_id')
        .eq('id', alarm.camera_id)
        .maybeSingle();
      eenCamId = camRow?.een_camera_id ?? null;
    }
    // Store for use by fetchOffsetClip (avoids stale join references)
    setResolvedEenCamId(eenCamId);

    // Fetch pre-alarm recorded clip — 3 minutes before → 1 minute after event
    // (wider window improves hit rate for cameras with delayed cloud upload)
    if (eenCamId && accountId2) {
      try {
        const alarmMs   = new Date(alarm.created_at).getTime();
        const startTime = new Date(alarmMs - 180_000).toISOString().replace(/Z$/, '+00:00');
        const endTime   = new Date(alarmMs + 60_000).toISOString().replace(/Z$/, '+00:00');
        const clipRes   = await fetch('/api/een/recorded', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            accountId: accountId2,
            cameraId:  eenCamId,
            startTime,
            endTime,
          }),
        });
        if (clipRes.ok) {
          const clipData = await clipRes.json();
          setPreAlarmUrl(clipData.url ?? null);
          setPreAlarmToken(clipData.token ?? null);  // token needed for HLS auth
        } else {
          setPreAlarmUrl(null);
          setPreAlarmToken(null);
        }
      } catch {
        setPreAlarmUrl(null);
        setPreAlarmToken(null);
      }
    } else {
      setPreAlarmUrl(null);
    }

    // Mark alarm as processing
    await supabase
      .from('alarms')
      .update({ status: 'processing' })
      .eq('id', alarm.id);
  }, []);

  // ── Suggest procedure steps via AI ───────────────────────────────────────
  const suggestSteps = useCallback(async () => {
    if (!activeAlarm) return;
    setSuggestingSteps(true);
    setStepSuggestion(null);
    try {
      const res = await fetch('/api/procedures/suggest', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          zoneId:    activeAlarm.zone_id,
          eventType: activeAlarm.event_type,
          save:      false,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setStepSuggestion(data.suggested ?? null);
      }
    } catch {}
    finally { setSuggestingSteps(false); }
  }, [activeAlarm]);

  const acceptSuggestion = useCallback(async () => {
    if (!activeAlarm || !stepSuggestion) return;
    // Save to procedures table and update UI
    await fetch('/api/procedures/suggest', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        zoneId:    activeAlarm.zone_id,
        eventType: activeAlarm.event_type,
        save:      true,
        steps:     stepSuggestion.steps,
        title:     stepSuggestion.title,
      }),
    });
    setProcedure(stepSuggestion.steps);
    setProcedureTitle(stepSuggestion.title);
    setProcedureChecked(new Array(stepSuggestion.steps.length).fill(false));
    setStepSuggestion(null);
  }, [activeAlarm, stepSuggestion]);

  // ── Quick dismiss (Nothing Seen / False Alarm) ────────────────────────────
  // Accepts any alarm — used from queue cards AND from the active alarm header
  const dismissAlarm = useCallback(async (alarm: Alarm, reason: 'nothing_seen' | 'false_alarm') => {
    // Optimistically remove from queue immediately
    setQueue(prev => prev.filter(a => a.id !== alarm.id));
    const accountId = alarm.account_id ?? alarm.zones?.account_id;
    await supabase.from('alarms').update({ status: 'resolved' }).eq('id', alarm.id);
    await supabase.from('audit_logs').insert({
      account_id:  accountId,
      alarm_id:    alarm.id,
      zone_id:     alarm.zone_id,
      operator_id: 'operator-1',
      action:      'alarm_dismissed',
      details:     JSON.stringify({ reason }),
      created_at:  new Date().toISOString(),
    });
    // If dismissing the currently active alarm, clear the canvas
    setActiveAlarm(prev => (prev?.id === alarm.id ? null : prev));
    setDoors(prev => (activeAlarm?.id === alarm.id ? [] : prev));
    setContacts(prev => (activeAlarm?.id === alarm.id ? [] : prev));
    setProcedure(prev => (activeAlarm?.id === alarm.id ? [] : prev));
    setSiteCameras(prev => (activeAlarm?.id === alarm.id ? [] : prev));
    setHistory(prev => (activeAlarm?.id === alarm.id ? [] : prev));
    if (activeAlarm?.id === alarm.id) {
      setPreAlarmUrl(undefined);
      setLiveOffset(0);
      setLiveOffsetUrl(null);
      setExpandedPanel(null);
    }
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
    // Use resolvedEenCamId from state (set during processAlarm) — avoids stale join
    const eenCamId  = resolvedEenCamId;
    const accountId = activeAlarm.account_id;
    if (!eenCamId || !accountId) {
      console.warn('[fetchOffsetClip] Missing eenCamId or accountId', { eenCamId, accountId });
      setFetchingClip(false);
      return;
    }

    const now       = Date.now();
    // offsetMinutes is negative (e.g. -5 = 5 minutes ago)
    const windowStart = now + offsetMinutes * 60_000;
    const startTime = new Date(windowStart).toISOString().replace(/Z$/, '+00:00');
    const endTime   = new Date(windowStart + 150_000).toISOString().replace(/Z$/, '+00:00'); // 2.5 min window
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
      } else {
        console.warn('[fetchOffsetClip] No clip found for offset', offsetMinutes);
      }
    } catch (err: any) {
      console.error('[fetchOffsetClip] Error:', err.message);
    }
    finally { setFetchingClip(false); }
  }, [activeAlarm, resolvedEenCamId]);

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

  // ── Hold door open ─────────────────────────────────────────────────────────
  const holdDoor = useCallback(async (door: Door) => {
    if (!activeAlarm) return;
    const accountId = activeAlarm.account_id ?? activeAlarm.zones?.account_id;
    setHoldSettingId(door.brivoId);
    setHoldError(null);
    try {
      const body: any = {
        accountId,
        doorId:       door.brivoId,
        mode:         holdMode,
        operatorId:   'operator-1',
        operatorName: 'Operator',
        alarmId:      activeAlarm.id,
      };
      if (holdMode === 'until_time') body.endTime = new Date(holdEndTime).toISOString();
      const res  = await fetch('/api/brivo/hold', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? 'Failed to set hold');
      setHoldActiveIds(prev => ({
        ...prev,
        [door.brivoId]: holdMode === 'until_time' ? new Date(holdEndTime).toISOString() : null,
      }));
      setHoldExpandedId(null);
    } catch (err: any) {
      setHoldError(err.message);
    } finally {
      setHoldSettingId(null);
    }
  }, [activeAlarm, holdMode, holdEndTime]);

  // ── Release door hold ──────────────────────────────────────────────────────
  const releaseHold = useCallback(async (door: Door) => {
    if (!activeAlarm) return;
    const accountId = activeAlarm.account_id ?? activeAlarm.zones?.account_id;
    setHoldReleasingId(door.brivoId);
    setHoldError(null);
    try {
      const res  = await fetch('/api/brivo/hold', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          accountId,
          doorId:       door.brivoId,
          operatorId:   'operator-1',
          operatorName: 'Operator',
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? 'Failed to release hold');
      setHoldActiveIds(prev => { const n = { ...prev }; delete n[door.brivoId]; return n; });
    } catch (err: any) {
      setHoldError(err.message);
    } finally {
      setHoldReleasingId(null);
    }
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
      setExpandedPanel(null);

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
      {/* Alert tone generated via Web Audio API — no file needed */}

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
          {totalAlarmCount > 0 && (
            <span className="flex items-center gap-1 bg-red-500/20 border border-red-500/30 rounded px-2 py-0.5 text-[10px] font-bold text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {totalAlarmCount}
              {totalAlarmCount > 50 && <span className="text-red-500/60">+</span>}
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
                  <p className="text-[10px] text-slate-300 truncate mb-0.5">
                    {alarm.event_label}
                  </p>
                  {alarm.cameras?.name && (
                    <p className="text-[9px] text-slate-500 truncate mb-2">
                      <span className="text-slate-600">cam: </span>{alarm.cameras.name}
                    </p>
                  )}
                  {!isActive && (
                    <div className="flex gap-1 mt-1.5">
                      <button
                        onClick={() => processAlarm(alarm)}
                        className="flex-1 py-1 rounded text-[9px] font-semibold uppercase tracking-wider bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-300 transition-all"
                      >
                        Process
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); dismissAlarm(alarm, 'nothing_seen'); }}
                        className="px-2 py-1 rounded text-[9px] font-bold bg-slate-700/50 hover:bg-slate-600/60 border border-white/[0.07] text-slate-500 hover:text-slate-300 transition-all"
                        title="Nothing seen — dismiss"
                      >
                        NS
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); dismissAlarm(alarm, 'false_alarm'); }}
                        className="px-2 py-1 rounded text-[9px] font-bold bg-sky-800/30 hover:bg-sky-700/40 border border-sky-600/20 text-sky-400 hover:text-sky-300 transition-all"
                        title="False alarm — dismiss"
                      >
                        FA
                      </button>
                    </div>
                  )}
                  {isActive && (
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="text-[9px] text-indigo-400 font-semibold uppercase tracking-wider">
                        — Active —
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); dismissAlarm(alarm, 'nothing_seen'); }}
                          className="px-2 py-0.5 rounded text-[8px] font-bold bg-slate-700/50 hover:bg-slate-600/60 border border-white/[0.07] text-slate-500 hover:text-slate-300 transition-all"
                          title="Nothing seen — dismiss"
                        >NS</button>
                        <button
                          onClick={(e) => { e.stopPropagation(); dismissAlarm(alarm, 'false_alarm'); }}
                          className="px-2 py-0.5 rounded text-[8px] font-bold bg-sky-800/30 hover:bg-sky-700/40 border border-sky-600/20 text-sky-400 hover:text-sky-300 transition-all"
                          title="False alarm — dismiss"
                        >FA</button>
                      </div>
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
              <div className="flex flex-col min-w-0">
                <span className="text-[13px] font-bold text-white leading-tight truncate">{activeAlarm.site_name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-300">{activeAlarm.event_label}</span>
                  {activeAlarm.cameras?.name && (
                    <span className="text-[9px] text-slate-500 font-mono truncate">· {activeAlarm.cameras.name}</span>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-slate-600 font-mono shrink-0">{fmtTime(activeAlarm.created_at)}</span>
              {/* Quick dismiss actions */}
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  onClick={() => dismissAlarm(activeAlarm, 'nothing_seen')}
                  className="px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-700/60 hover:bg-slate-600/60 border border-white/[0.08] text-slate-400 hover:text-slate-200 transition-all"
                  title="Mark as nothing seen and clear from queue"
                >
                  Nothing Seen
                </button>
                <button
                  onClick={() => dismissAlarm(activeAlarm, 'false_alarm')}
                  className="px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider bg-sky-700/30 hover:bg-sky-600/40 border border-sky-500/20 text-sky-400 hover:text-sky-300 transition-all"
                  title="Mark as false alarm and clear from queue"
                >
                  False Alarm
                </button>
              </div>
            </div>

            {/* TOP: Dual Video stacked vertically — each panel gets a fixed slice */}
            <div className="flex flex-col gap-px bg-black overflow-hidden" style={{ height: '50%' }}>

              {/* ── Pre-alarm / Recorded panel ─────────────────────────── */}
              {expandedPanel !== 'live' && (
                <div
                  className={`relative cursor-pointer overflow-hidden ${expandedPanel === 'pre-alarm' ? 'flex-1' : 'h-1/2'}`}
                  onDoubleClick={() => setExpandedPanel(p => p === 'pre-alarm' ? null : 'pre-alarm')}
                  title="Double-click to expand / collapse"
                >
                  {/* Label */}
                  <div className="absolute top-2 left-2 z-10 bg-amber-600/80 border border-amber-500/30 px-2 py-0.5 rounded text-[9px] font-bold text-white uppercase tracking-wider pointer-events-none">
                    Pre-Alarm Clip
                  </div>
                  {/* Expand/collapse indicator */}
                  <div className="absolute top-2 right-2 z-10 pointer-events-none">
                    <span className="text-[8px] text-white/25 bg-black/40 px-1 py-0.5 rounded">
                      {expandedPanel === 'pre-alarm' ? '⊡ dbl-click collapse' : '⤢ dbl-click expand'}
                    </span>
                  </div>

                  {activeCameraId && typeof preAlarmUrl === 'string' ? (
                    <SmartVideoPlayer
                      accountId={activeAccountId}
                      cameraId={activeCameraId}
                      source={activeCameraSource as 'brivo' | 'een'}
                      streamType="preview"
                      recordedUrl={preAlarmUrl}
                      recordedToken={preAlarmToken ?? undefined}
                      label=""
                    />
                  ) : activeCameraId && preAlarmUrl === undefined ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-black gap-2">
                      <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                      <p className="text-[9px] text-amber-700">Fetching clip...</p>
                    </div>
                  ) : activeCameraId ? (
                    <div className="w-full h-full flex items-center justify-center bg-black">
                      <p className="text-[10px] text-slate-600">No pre-alarm clip available</p>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-black">
                      <p className="text-[10px] text-slate-600">No camera assigned</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Live feed panel ────────────────────────────────────── */}
              {expandedPanel !== 'pre-alarm' && (
                <div
                  className={`relative cursor-pointer overflow-hidden ${expandedPanel === 'live' ? 'flex-1' : 'h-1/2'}`}
                  onDoubleClick={(e) => {
                    if ((e.target as HTMLElement).tagName !== 'BUTTON') {
                      setExpandedPanel(p => p === 'live' ? null : 'live');
                    }
                  }}
                  title="Double-click to expand / collapse"
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

                  {/* Time navigation + expand indicator */}
                  <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5" onDoubleClick={e => e.stopPropagation()}>
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
                    <span className="text-[8px] text-white/25 bg-black/40 px-1 py-0.5 rounded pointer-events-none">
                      {expandedPanel === 'live' ? '⊡ dbl-click collapse' : '⤢ dbl-click expand'}
                    </span>
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
              )}
            </div>

            {/* BOTTOM 45%: Tabs */}
            <div className="flex-1 flex flex-col min-h-0">
              {/* Tab bar */}
              <div className="flex border-b border-white/[0.06] px-2 pt-1 gap-1 items-end">
                {(['cameras', 'history', 'scripts', 'notes'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider rounded-t transition-all ${
                      activeTab === tab
                        ? 'text-white border-b-2 border-indigo-500'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {tab === 'cameras' ? `Cameras (${siteCameras.length})` : tab === 'history' ? 'History' : tab === 'scripts' ? 'Scripts' : 'Notes'}
                  </button>
                ))}
                {/* Grid/List toggle — only visible on cameras tab */}
                {activeTab === 'cameras' && siteCameras.length > 0 && (
                  <div className="ml-auto mb-1 flex items-center gap-0.5 bg-white/[0.04] border border-white/[0.06] rounded p-0.5">
                    <button
                      onClick={() => setCamerasView('grid')}
                      className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all ${camerasView === 'grid' ? 'bg-indigo-600/60 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                      title="Grid view"
                    >⊞ Grid</button>
                    <button
                      onClick={() => setCamerasView('list')}
                      className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all ${camerasView === 'list' ? 'bg-indigo-600/60 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                      title="List view"
                    >≡ List</button>
                  </div>
                )}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto p-3">
                {/* Site Cameras */}
                {activeTab === 'cameras' && (
                  <>
                    {/* Grid view */}
                    {camerasView === 'grid' && (
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

                    {/* List view */}
                    {camerasView === 'list' && (
                      <div className="space-y-1">
                        {siteCameras.map((cam) => {
                          const camId = cam.brivo_camera_id ?? cam.een_camera_id ?? '';
                          const isSelected = camId === activeCameraId;
                          return (
                            <div
                              key={cam.id}
                              onClick={() => setActiveCameraId(camId)}
                              className={`flex items-center gap-2.5 px-2.5 py-2 rounded border cursor-pointer transition-all
                                ${isSelected
                                  ? 'border-indigo-500/60 bg-indigo-600/10 ring-1 ring-indigo-500/20'
                                  : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12]'
                                }`}
                            >
                              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-indigo-400' : 'bg-slate-600'}`} />
                              <div className="w-3 h-3 text-slate-500 shrink-0"><Ic.Camera /></div>
                              <span className="text-[11px] font-medium text-slate-200 truncate flex-1">{cam.name}</span>
                              <span className="text-[8px] text-slate-600 uppercase">{cam.source}</span>
                              {isSelected && (
                                <span className="text-[8px] text-indigo-400 font-bold uppercase tracking-wider shrink-0">Active</span>
                              )}
                            </div>
                          );
                        })}
                        {siteCameras.length === 0 && (
                          <div className="py-6 text-center text-[10px] text-slate-600">
                            No cameras configured for this site
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Event History — resolved alarms for this zone */}
                {activeTab === 'history' && (
                  <div className="space-y-1">
                    {history.map((h: any, i: number) => {
                      const cfg = PRIORITY_CONFIG[h.priority as Priority] ?? PRIORITY_CONFIG.P3;
                      return (
                        <div
                          key={i}
                          className="flex items-start gap-2.5 px-2.5 py-2 rounded bg-white/[0.02] border border-white/[0.05]"
                        >
                          <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-slate-200 truncate">{h.event_label}</p>
                            {h.cameras?.name && (
                              <p className="text-[9px] text-slate-500 truncate">{h.cameras.name}</p>
                            )}
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-[9px] text-slate-600 font-mono">{fmtTime(h.created_at)}</p>
                              <span className="text-[8px] text-slate-600 uppercase">{h.status}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {history.length === 0 && (
                      <p className="text-center text-[10px] text-slate-500 py-6">No resolved events for this site yet</p>
                    )}
                  </div>
                )}

                {/* Scripts — pre-written operator announcement scripts */}
                {activeTab === 'scripts' && (
                  <div className="space-y-2">
                    {[
                      {
                        label: 'Identity Check',
                        color: 'border-indigo-500/30 bg-indigo-600/10',
                        text: 'This is GateGuard security monitoring. You are being recorded. Please identify yourself and state your purpose.',
                      },
                      {
                        label: 'Unauthorized Warning',
                        color: 'border-amber-500/30 bg-amber-600/10',
                        text: 'Attention — this is a private property. You are in a restricted area. Please leave immediately or security will be dispatched.',
                      },
                      {
                        label: 'No Trespassing',
                        color: 'border-red-500/30 bg-red-600/10',
                        text: 'Warning — you are trespassing on private property. This area is monitored 24/7. Law enforcement has been notified.',
                      },
                      {
                        label: 'After-Hours Notice',
                        color: 'border-slate-500/30 bg-slate-600/10',
                        text: 'This property is closed. Business hours are Monday through Friday, 8am to 6pm. Please return during business hours.',
                      },
                      {
                        label: 'Vehicle Warning',
                        color: 'border-amber-500/30 bg-amber-600/10',
                        text: 'Attention driver — you are in a monitored area. Parking in this location is prohibited. Please move your vehicle immediately.',
                      },
                      {
                        label: 'Police Dispatched',
                        color: 'border-red-500/30 bg-red-600/10',
                        text: 'Attention — police have been dispatched to this location. For your safety, please remain where you are and cooperate with responding officers.',
                      },
                    ].map((script, i) => (
                      <ScriptCard key={i} {...script} />
                    ))}
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

          {/* ── Active Alarm Summary card ── */}
          {activeAlarm ? (
            <div className={`rounded-lg border px-3 py-2.5 ${PRIORITY_CONFIG[activeAlarm.priority].bg} ${PRIORITY_CONFIG[activeAlarm.priority].ring} ring-1 border-transparent`}>
              <div className="flex items-center gap-2 mb-1">
                <PriorityBadge p={activeAlarm.priority} />
                <span className="text-[9px] text-slate-400 font-mono ml-auto">{fmtTime(activeAlarm.created_at)}</span>
              </div>
              <p className="text-[13px] font-bold text-white leading-snug">{activeAlarm.site_name}</p>
              <p className="text-[11px] text-slate-200 mt-0.5">{activeAlarm.event_label}</p>
              {activeAlarm.cameras?.name && (
                <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                  <span className="w-2.5 h-2.5 inline-block text-slate-500"><Ic.Camera /></span>
                  {activeAlarm.cameras.name}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-4 text-center">
              <p className="text-[10px] text-slate-600 uppercase tracking-wider">No active alarm</p>
            </div>
          )}

          {/* ── 1. Brivo Access Control ── */}
          <section>
            <SectionHeader icon={<Ic.Lock />} label="Brivo Access Control" />
            {!activeAlarm ? (
              <p className="text-[10px] text-slate-500 text-center py-3">Awaiting alarm</p>
            ) : doorsLoading ? (
              <div className="flex justify-center py-3">
                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : doors.length === 0 ? (
              <p className="text-[10px] text-slate-500 text-center py-3">No doors configured for this site</p>
            ) : (
              <div className="space-y-1.5">
                {doors.map((door) => {
                  const isOpening    = doorOpeningId    === door.brivoId;
                  const isOpen       = doorOpenedId     === door.brivoId;
                  const isHoldActive = door.brivoId in holdActiveIds;
                  const holdUntil    = holdActiveIds[door.brivoId];
                  const isSetting    = holdSettingId    === door.brivoId;
                  const isReleasing  = holdReleasingId  === door.brivoId;
                  const holdExpanded = holdExpandedId   === door.brivoId;

                  return (
                    <div
                      key={door.id}
                      className={`rounded border transition-all ${
                        isHoldActive
                          ? 'border-amber-500/30 bg-amber-500/[0.05]'
                          : isOpen
                            ? 'border-emerald-500/40 bg-emerald-500/10'
                            : 'border-white/[0.06] bg-white/[0.02]'
                      }`}
                    >
                      {/* Main door row */}
                      <div className="flex items-center justify-between px-2.5 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-3.5 h-3.5 shrink-0 ${isHoldActive ? 'text-amber-400' : isOpen ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {isOpen ? <Ic.Unlock /> : <Ic.Lock />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold text-white truncate">{door.name}</p>
                            <p className="text-[9px] text-slate-500 capitalize">
                              {isHoldActive
                                ? holdUntil
                                  ? `Held until ${new Date(holdUntil).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}`
                                  : 'Held open indefinitely'
                                : door.type}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {/* Open button */}
                          <button
                            onClick={() => openDoor(door)}
                            disabled={isOpening || isOpen}
                            className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all
                              ${isOpen
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default'
                                : isOpening
                                  ? 'bg-white/[0.05] text-slate-500 border border-white/[0.06] cursor-wait'
                                  : 'bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30'
                              }`}
                          >
                            {isOpen ? '✓' : isOpening ? '...' : 'Open'}
                          </button>
                          {/* Hold toggle / release button */}
                          {isHoldActive ? (
                            <button
                              onClick={() => releaseHold(door)}
                              disabled={isReleasing}
                              title="Release hold"
                              className="px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider border border-amber-500/30 bg-amber-500/10 hover:bg-red-500/20 hover:border-red-500/30 text-amber-400 hover:text-red-400 transition-all disabled:opacity-40"
                            >
                              {isReleasing ? '...' : 'Release'}
                            </button>
                          ) : (
                            <button
                              onClick={() => setHoldExpandedId(holdExpanded ? null : door.brivoId)}
                              title="Hold open"
                              className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider border transition-all ${
                                holdExpanded
                                  ? 'bg-amber-600/20 border-amber-500/30 text-amber-300'
                                  : 'bg-white/[0.03] border-white/[0.06] text-slate-600 hover:text-amber-300 hover:border-amber-500/30'
                              }`}
                            >
                              Hold
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Hold config panel — expands inline */}
                      {holdExpanded && !isHoldActive && (
                        <div className="px-2.5 pb-2.5 flex flex-col gap-2 border-t border-white/[0.04] pt-2">
                          {/* Mode toggle */}
                          <div className="grid grid-cols-2 gap-1.5">
                            {(['indefinite', 'until_time'] as const).map(m => (
                              <button
                                key={m}
                                onClick={() => setHoldMode(m)}
                                className={`py-1 rounded border text-[9px] font-medium transition-all ${
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
                              className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-indigo-500/50 [color-scheme:dark]"
                            />
                          )}
                          <button
                            onClick={() => holdDoor(door)}
                            disabled={isSetting || (holdMode === 'until_time' && !holdEndTime)}
                            className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[10px] font-semibold transition-all disabled:opacity-40"
                          >
                            {isSetting
                              ? <div className="w-2.5 h-2.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                              : null}
                            {isSetting ? 'Setting Hold…' : 'Hold Open'}
                          </button>
                          {holdError && (
                            <p className="text-[9px] text-red-400">✗ {holdError}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── 2. AI Recommended Steps ── */}
          <section>
            <SectionHeader
              icon={<Ic.ClipboardList />}
              label="AI Recommended Steps"
              action={activeAlarm ? (
                <button
                  onClick={suggestSteps}
                  disabled={suggestingSteps}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 text-violet-300 hover:text-violet-200 transition-all disabled:opacity-40 disabled:cursor-wait"
                  title="Use AI to analyze past incidents and suggest updated steps"
                >
                  {suggestingSteps ? (
                    <><span className="w-2.5 h-2.5 border border-violet-400 border-t-transparent rounded-full animate-spin inline-block" /> Thinking...</>
                  ) : '✦ Suggest'}
                </button>
              ) : undefined}
            />

            {/* ── Live AI triage result for this alarm ── */}
            {triageResult && (
              <div className={`mb-3 rounded border p-2.5 space-y-1.5 ${
                triageResult.decision === 'escalate'       ? 'bg-red-600/10 border-red-500/30' :
                triageResult.decision === 'route_to_human' ? 'bg-amber-600/10 border-amber-500/30' :
                'bg-emerald-600/10 border-emerald-500/30'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      triageResult.decision === 'escalate'       ? 'bg-red-500/20 text-red-400' :
                      triageResult.decision === 'route_to_human' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {triageResult.decision === 'escalate' ? '⚠ Escalate' :
                       triageResult.decision === 'route_to_human' ? '👤 Review' : '✓ Low Risk'}
                    </span>
                    <span className="text-[8px] text-slate-500 font-mono">{triageResult.confidence}% confidence</span>
                  </div>
                  <span className="text-[8px] text-slate-700">GG AI</span>
                </div>
                <p className="text-[10px] text-slate-200 leading-relaxed">{triageResult.interpretation}</p>
                {triageResult.suggested_steps?.length > 0 && (
                  <div className="space-y-0.5 pt-0.5 border-t border-white/[0.06]">
                    <p className="text-[8px] text-slate-500 uppercase tracking-wider mb-1">AI Suggested Steps</p>
                    {triageResult.suggested_steps.slice(0, 4).map((step, i) => (
                      <p key={i} className="text-[9px] text-slate-300 flex gap-1.5">
                        <span className="text-slate-600 shrink-0">{i + 1}.</span>{step}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* AI suggestion panel */}
            {stepSuggestion && (
              <div className="mb-2 rounded border border-violet-500/30 bg-violet-600/10 p-2.5 space-y-1.5">
                <p className="text-[9px] font-bold text-violet-300 uppercase tracking-wider">AI Suggestion</p>
                <p className="text-[10px] font-semibold text-white">{stepSuggestion.title}</p>
                <p className="text-[9px] text-slate-400 italic">{stepSuggestion.reasoning}</p>
                <div className="space-y-0.5 mt-1">
                  {stepSuggestion.steps.map((s, i) => (
                    <p key={i} className="text-[9px] text-slate-300 flex gap-1.5">
                      <span className="text-violet-500 font-mono shrink-0">{i+1}.</span>{s.text}
                    </p>
                  ))}
                </div>
                <div className="flex gap-1.5 pt-1">
                  <button
                    onClick={acceptSuggestion}
                    className="flex-1 py-1 rounded text-[9px] font-bold uppercase tracking-wider bg-violet-600/40 hover:bg-violet-600/60 border border-violet-500/40 text-violet-200 transition-all"
                  >
                    ✓ Accept & Save
                  </button>
                  <button
                    onClick={() => setStepSuggestion(null)}
                    className="px-2.5 py-1 rounded text-[9px] font-bold bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-slate-400 transition-all"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {procedure.length === 0 ? (
              <p className="text-[10px] text-slate-500 text-center py-3">
                {activeAlarm ? 'No procedure configured — use ✦ Suggest to generate one' : 'Awaiting alarm'}
              </p>
            ) : (
              <div className="space-y-1">
                <p className="text-[9px] text-slate-400 mb-2">{procedureTitle}</p>
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
              <p className="text-[10px] text-slate-500 text-center py-3">
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
                <p className="text-[9px] text-slate-400 px-1">
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
                    : 'bg-white/[0.06] text-slate-400 border border-white/[0.12] cursor-not-allowed'
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
