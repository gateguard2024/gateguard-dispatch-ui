'use client';
// app/comms/page.tsx
// Standalone Communications Desk — Dial, Email, Log
// No alarm or patrol context required.
// Left panel: site + contact picker  |  Right panel: Dial / Email / Log

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import DialerModal, { DialerTarget } from '@/components/DialerModal';
import { useUser } from '@clerk/nextjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── Types ─────────────────────────────────────────────────────────────────────

type CommsTab = 'dial' | 'email' | 'log';
type EmailTemplate = 'incident_report' | 'gate_service' | 'check_in' | 'all_clear' | 'custom';

interface Site   { id: string; name: string; }
interface Contact {
  id:    string;
  name:  string;
  role:  string;
  phone: string | null;
  email: string | null;
}
interface LogEntry {
  id:           string;
  note?:        string;
  template?:    string;
  to_number?:   string;
  to_email?:    string;
  operator_name: string;
  created_at:   string;
  type?:        'call' | 'email' | 'log';
}

const TEMPLATES: { value: EmailTemplate; label: string; desc: string; icon: string }[] = [
  { value: 'incident_report', label: 'Incident Report',     desc: 'Full alarm summary to site + ops',  icon: '🚨' },
  { value: 'gate_service',    label: 'Gate / Door Service', desc: 'Service needed notification',        icon: '🚪' },
  { value: 'check_in',        label: 'Patrol Check-In',     desc: 'Routine patrol status to site',      icon: '✅' },
  { value: 'all_clear',       label: 'All Clear',           desc: 'Confirm site is clear',              icon: '🟢' },
  { value: 'custom',          label: 'Custom Message',      desc: 'Write your own subject + body',      icon: '✏️' },
];

const ROLE_COLORS: Record<string, string> = {
  'Courtesy Officer':         'border-amber-500/40  text-amber-400',
  'Property Manager':         'border-violet-500/40 text-violet-400',
  'Property Staff':           'border-violet-500/40 text-violet-400',
  'Police Department':        'border-blue-500/40   text-blue-400',
  'Fire Department':          'border-red-500/40    text-red-400',
  'EMS':                      'border-red-500/40    text-red-400',
  'Emergency Contact':        'border-indigo-500/40 text-indigo-400',
  'Authorized After-Hours Employee': 'border-teal-500/40 text-teal-400',
  'Reporting Contact':        'border-slate-500/40  text-slate-400',
};

// ── Main component ─────────────────────────────────────────────────────────────

export default function CommsPage() {
  const { user } = useUser();
  const operatorName = user?.firstName ?? user?.emailAddresses?.[0]?.emailAddress?.split('@')[0] ?? 'Operator';
  const operatorId   = user?.id ?? null;

  // ── Site + contact state ────────────────────────────────────────────────────
  const [sites,          setSites]          = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [contacts,       setContacts]       = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [sitesLoading,   setSitesLoading]   = useState(true);

  // ── Comms tab state ─────────────────────────────────────────────────────────
  const [tab, setTab] = useState<CommsTab>('dial');

  // ── Dialer ──────────────────────────────────────────────────────────────────
  const [phoneInput,  setPhoneInput]  = useState('');
  const [dialerModal, setDialerModal] = useState<DialerTarget | null>(null);

  // ── Email ───────────────────────────────────────────────────────────────────
  const [emailTo,       setEmailTo]       = useState('');
  const [template,      setTemplate]      = useState<EmailTemplate>('incident_report');
  const [emailNotes,    setEmailNotes]    = useState('');
  const [incidentType,  setIncidentType]  = useState('');
  const [location,      setLocation]      = useState('');
  const [subjects,      setSubjects]      = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [customBody,    setCustomBody]    = useState('');
  const [ccOps,         setCcOps]         = useState(true);
  const [sending,       setSending]       = useState(false);
  const [emailResult,   setEmailResult]   = useState<{ ok: boolean; msg: string } | null>(null);

  // ── Log ─────────────────────────────────────────────────────────────────────
  const [logNote,    setLogNote]    = useState('');
  const [logSaving,  setLogSaving]  = useState(false);
  const [logResult,  setLogResult]  = useState<{ ok: boolean; msg: string } | null>(null);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(false);

  const selectedSite = sites.find(s => s.id === selectedSiteId);

  // ── Load sites ──────────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadSites() {
      const { data } = await supabase
        .from('accounts')
        .select('id, name')
        .order('name');
      setSites(data ?? []);
      if (data?.length) setSelectedSiteId(data[0].id);
      setSitesLoading(false);
    }
    loadSites();
  }, []);

  // ── Load contacts when site changes ────────────────────────────────────────
  useEffect(() => {
    if (!selectedSiteId) { setContacts([]); setSelectedContact(null); return; }
    async function loadContacts() {
      const { data } = await supabase
        .from('zone_contacts')
        .select('id, name, role, phone, email')
        .eq('account_id', selectedSiteId)
        .order('priority', { ascending: true });
      const list = data ?? [];
      setContacts(list);
      setSelectedContact(null);
      // Pre-fill dialer/email from first contact with phone/email
      const firstPhone = list.find(c => c.phone);
      const firstEmail = list.find(c => c.email);
      setPhoneInput(firstPhone?.phone ?? '');
      setEmailTo(firstEmail?.email ?? '');
    }
    loadContacts();
  }, [selectedSiteId]);

  // ── Load activity log ───────────────────────────────────────────────────────
  const loadLog = useCallback(async () => {
    if (!selectedSiteId) return;
    setLogLoading(true);
    try {
      // Merge calls, emails, and manual_logs for this site (last 50 each)
      const [callsRes, emailsRes, logsRes] = await Promise.all([
        supabase.from('calls').select('id, to_number, operator_name, created_at, site_name')
          .eq('site_name', selectedSite?.name ?? '')
          .order('created_at', { ascending: false }).limit(20),
        supabase.from('emails_sent').select('id, to_email, template, operator_name, created_at, site_name')
          .eq('site_name', selectedSite?.name ?? '')
          .order('created_at', { ascending: false }).limit(20),
        supabase.from('manual_logs').select('id, note, operator_name, created_at, site_name')
          .eq('site_name', selectedSite?.name ?? '')
          .order('created_at', { ascending: false }).limit(20),
      ]);

      const merged: LogEntry[] = [
        ...(callsRes.data ?? []).map(r => ({ ...r, type: 'call'  as const })),
        ...(emailsRes.data ?? []).map(r => ({ ...r, type: 'email' as const })),
        ...(logsRes.data ?? []).map(r => ({ ...r, type: 'log'   as const })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 60);

      setLogEntries(merged);
    } finally {
      setLogLoading(false);
    }
  }, [selectedSiteId, selectedSite]);

  useEffect(() => {
    if (tab === 'log') loadLog();
  }, [tab, selectedSiteId]);

  // ── Select contact → pre-fill ───────────────────────────────────────────────
  function selectContact(c: Contact) {
    setSelectedContact(c);
    if (c.phone) setPhoneInput(c.phone);
    if (c.email) setEmailTo(c.email);
  }

  // ── Dial — opens the WebRTC browser phone modal ─────────────────────────────
  function handleCall() {
    if (!phoneInput.trim()) return;
    setDialerModal({
      phone:    phoneInput.trim(),
      siteName: selectedSite?.name,
    });
  }

  // ── Email ────────────────────────────────────────────────────────────────────
  async function handleEmail() {
    if (!emailTo.trim()) return;
    setSending(true);
    setEmailResult(null);
    const res = await fetch('/api/comms/email', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        to:            emailTo.trim(),
        template,
        siteName:      selectedSite?.name ?? '',
        operatorName,
        notes:         emailNotes || undefined,
        incidentType:  incidentType || undefined,
        location:      location     || undefined,
        subjects:      subjects     || undefined,
        customSubject: template === 'custom' ? customSubject : undefined,
        customBody:    template === 'custom' ? customBody    : undefined,
        ccOps,
      }),
    });
    const json = await res.json();
    setSending(false);
    setEmailResult(res.ok
      ? { ok: true,  msg: 'Email sent successfully.' }
      : { ok: false, msg: json.error ?? 'Failed to send' });
    if (res.ok) { setEmailNotes(''); setCustomSubject(''); setCustomBody(''); }
  }

  // ── Log ──────────────────────────────────────────────────────────────────────
  async function handleLog() {
    if (!logNote.trim()) return;
    setLogSaving(true);
    setLogResult(null);
    const res = await fetch('/api/comms/log', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        note:         logNote.trim(),
        operatorId,
        operatorName,
        siteName:     selectedSite?.name ?? '',
      }),
    });
    const json = await res.json();
    setLogSaving(false);
    if (res.ok) {
      setLogNote('');
      setLogResult({ ok: true, msg: 'Note saved.' });
      // Append to list immediately
      setLogEntries(prev => [{
        id: json.entry?.id ?? Date.now().toString(),
        note: logNote.trim(),
        operator_name: operatorName,
        created_at: new Date().toISOString(),
        type: 'log',
      }, ...prev]);
    } else {
      setLogResult({ ok: false, msg: json.error ?? 'Failed to save' });
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex overflow-hidden">

      {/* ── LEFT PANEL — site + contact picker ─────────────────────────────── */}
      <aside className="w-72 shrink-0 flex flex-col border-r border-white/[0.06] bg-[#080a0e]">

        {/* Header */}
        <div className="px-4 pt-5 pb-3 border-b border-white/[0.05]">
          <h1 className="text-[11px] font-black tracking-widest text-slate-300 uppercase">Communications</h1>
          <p className="text-[9px] text-slate-600 mt-0.5">Dial · Email · Log</p>
        </div>

        {/* Site picker */}
        <div className="px-3 py-3 border-b border-white/[0.05]">
          <label className="block text-[8px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">Site</label>
          {sitesLoading ? (
            <div className="h-8 rounded bg-white/[0.04] animate-pulse" />
          ) : (
            <select
              value={selectedSiteId}
              onChange={e => setSelectedSiteId(e.target.value)}
              className="w-full bg-[#0d1117] border border-white/[0.10] rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-indigo-500/50"
            >
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </div>

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
          <p className="text-[8px] font-bold uppercase tracking-wider text-slate-600 px-0.5 py-1">Contacts</p>
          {contacts.length === 0 ? (
            <p className="text-[10px] text-slate-600 text-center py-6">No contacts for this site</p>
          ) : contacts.map(c => (
            <button
              key={c.id}
              onClick={() => selectContact(c)}
              className={`w-full text-left rounded-lg border px-2.5 py-2 transition-all ${
                selectedContact?.id === c.id
                  ? 'border-indigo-500/40 bg-indigo-500/10'
                  : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className={`text-[7px] font-bold uppercase px-1.5 py-0.5 rounded border ${ROLE_COLORS[c.role] ?? 'border-slate-500/40 text-slate-400'}`}>
                    {c.role.replace(/_/g, ' ')}
                  </span>
                  <p className="text-[10px] font-semibold text-white mt-1 truncate">{c.name}</p>
                  {c.phone && <p className="text-[8px] text-slate-500 font-mono mt-0.5">{c.phone}</p>}
                  {c.email && <p className="text-[8px] text-slate-600 truncate mt-0.5">{c.email}</p>}
                </div>
                {/* Quick-dial icon */}
                {c.phone && (
                  <button
                    onClick={e => { e.stopPropagation(); setDialerModal({ phone: c.phone!, name: c.name, siteName: selectedSite?.name }); }}
                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded border border-white/[0.08] bg-white/[0.02] hover:bg-emerald-500/20 hover:border-emerald-500/40 text-slate-500 hover:text-emerald-300 transition-all"
                    title="Quick dial"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 6.75z"/>
                    </svg>
                  </button>
                )}
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* ── RIGHT PANEL — Dial / Email / Log ────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Tab bar */}
        <div className="flex items-center gap-1 px-4 pt-4 pb-0 border-b border-white/[0.06] shrink-0">
          {([
            { id: 'dial'  as CommsTab, label: 'Dial',  icon: '📞' },
            { id: 'email' as CommsTab, label: 'Email', icon: '✉️' },
            { id: 'log'   as CommsTab, label: 'Log',   icon: '📋' },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-bold tracking-wide rounded-t-lg border-t border-x transition-all ${
                tab === t.id
                  ? 'border-white/[0.12] bg-[#0d1117] text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── DIAL TAB ────────────────────────────────────────────────────── */}
          {tab === 'dial' && (
            <div className="max-w-md space-y-5">
              <div>
                <h2 className="text-[13px] font-bold text-white mb-1">Outbound Call</h2>
                <p className="text-[10px] text-slate-500">
                  Calls are placed via Twilio. The recipient sees the GateGuard 844 number as caller ID — not your personal number or computer.
                </p>
              </div>

              {selectedSite && (
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.07] px-3 py-2.5">
                  <p className="text-[9px] text-slate-500">Site</p>
                  <p className="text-[11px] font-semibold text-white">{selectedSite.name}</p>
                </div>
              )}

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Phone Number — 10 digits or +1…
                </label>
                <input
                  type="tel"
                  value={phoneInput}
                  onChange={e => setPhoneInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCall()}
                  placeholder="8005551234 or +18005551234"
                  className="w-full bg-[#0a0c10] border border-white/[0.12] rounded-lg px-3 py-2.5 text-[14px] font-mono text-white placeholder-slate-700 focus:outline-none focus:border-emerald-500/50 tracking-wider"
                />
                <p className="text-[8px] text-slate-600 mt-1">
                  Caller ID: <span className="text-slate-400 font-mono">GateGuard 844</span>
                  {' · '}Callback: <span className="text-slate-400 font-mono">844-469-4283 x900</span>
                </p>
              </div>

              <button
                onClick={handleCall}
                disabled={!phoneInput.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-[11px] font-bold text-white transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 6.75z"/>
                </svg>
                Open Dialer
              </button>

              {/* Recent contacts quick-dial */}
              {contacts.filter(c => c.phone).length > 0 && (
                <div>
                  <p className="text-[8px] font-bold uppercase tracking-wider text-slate-600 mb-2">Quick Dial — {selectedSite?.name}</p>
                  <div className="space-y-1.5">
                    {contacts.filter(c => c.phone).map(c => (
                      <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                        <div>
                          <p className="text-[10px] font-semibold text-white">{c.name}</p>
                          <p className="text-[9px] text-slate-500 font-mono">{c.phone}</p>
                        </div>
                        <button
                          onClick={() => setDialerModal({ phone: c.phone!, name: c.name, siteName: selectedSite?.name })}
                          className="text-[9px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          Call
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── EMAIL TAB ───────────────────────────────────────────────────── */}
          {tab === 'email' && (
            <div className="max-w-lg space-y-5">
              <div>
                <h2 className="text-[13px] font-bold text-white mb-1">Send Email</h2>
                <p className="text-[10px] text-slate-500">
                  Emails send from <span className="font-mono text-slate-400">soc@ggsoc.com</span>. Choose a template or write a custom message.
                </p>
              </div>

              {/* To */}
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">To</label>
                <input
                  type="email"
                  value={emailTo}
                  onChange={e => setEmailTo(e.target.value)}
                  placeholder="contact@property.com"
                  className="w-full bg-[#0a0c10] border border-white/[0.12] rounded-lg px-3 py-2.5 text-[12px] text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                />
                {/* Quick-fill from contacts */}
                {contacts.filter(c => c.email).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {contacts.filter(c => c.email).map(c => (
                      <button
                        key={c.id}
                        onClick={() => setEmailTo(c.email!)}
                        className="text-[8px] px-2 py-0.5 rounded border border-white/[0.08] text-slate-400 hover:border-indigo-500/40 hover:text-indigo-400 transition-all"
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Template picker */}
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-2">Template</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {TEMPLATES.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setTemplate(t.value)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                        template === t.value
                          ? 'border-indigo-500/50 bg-indigo-500/10 text-white'
                          : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:bg-white/[0.04]'
                      }`}
                    >
                      <span className="text-[14px]">{t.icon}</span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold">{t.label}</p>
                        <p className="text-[9px] opacity-60">{t.desc}</p>
                      </div>
                      {template === t.value && (
                        <svg className="w-3.5 h-3.5 ml-auto shrink-0 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Incident detail fields — shown for incident_report template */}
              {template === 'incident_report' && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3.5 space-y-3">
                  <p className="text-[8px] font-bold uppercase tracking-wider text-amber-500/70">Intelligence &amp; Evidence</p>
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">Incident Type</label>
                    <input
                      type="text"
                      value={incidentType}
                      onChange={e => setIncidentType(e.target.value)}
                      placeholder="e.g. Unauthorized Access, Theft, Disturbance…"
                      className="w-full bg-[#0a0c10] border border-white/[0.12] rounded-lg px-3 py-2 text-[11px] text-white placeholder-slate-700 focus:outline-none focus:border-amber-500/40"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">Location</label>
                    <input
                      type="text"
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      placeholder="e.g. Gate 3 / Building A / Parking Deck…"
                      className="w-full bg-[#0a0c10] border border-white/[0.12] rounded-lg px-3 py-2 text-[11px] text-white placeholder-slate-700 focus:outline-none focus:border-amber-500/40"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">Subjects / Vehicles</label>
                    <input
                      type="text"
                      value={subjects}
                      onChange={e => setSubjects(e.target.value)}
                      placeholder="e.g. Male, ~30s, black hoodie · Silver Toyota Camry…"
                      className="w-full bg-[#0a0c10] border border-white/[0.12] rounded-lg px-3 py-2 text-[11px] text-white placeholder-slate-700 focus:outline-none focus:border-amber-500/40"
                    />
                  </div>
                </div>
              )}

              {/* Custom fields */}
              {template === 'custom' && (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={customSubject}
                    onChange={e => setCustomSubject(e.target.value)}
                    placeholder="Subject"
                    className="w-full bg-[#0a0c10] border border-white/[0.12] rounded-lg px-3 py-2 text-[11px] text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                  />
                  <textarea
                    value={customBody}
                    onChange={e => setCustomBody(e.target.value)}
                    placeholder="Message body…"
                    rows={4}
                    className="w-full bg-[#0a0c10] border border-white/[0.12] rounded-lg px-3 py-2 text-[11px] text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 resize-none"
                  />
                </div>
              )}

              {/* Notes (for non-custom templates) */}
              {template !== 'custom' && (
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    {template === 'incident_report' ? 'Narrative / Additional Notes' : 'Additional Notes (optional)'}
                  </label>
                  <textarea
                    value={emailNotes}
                    onChange={e => setEmailNotes(e.target.value)}
                    placeholder={template === 'incident_report'
                      ? 'Describe the incident in detail — timeline, actions taken, outcomes…'
                      : 'Any extra context to include in the email…'}
                    rows={template === 'incident_report' ? 5 : 3}
                    className="w-full bg-[#0a0c10] border border-white/[0.12] rounded-lg px-3 py-2 text-[11px] text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 resize-none"
                  />
                </div>
              )}

              {/* CC ops */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ccOps}
                  onChange={e => setCcOps(e.target.checked)}
                  className="rounded border-white/20 bg-transparent text-indigo-500"
                />
                <span className="text-[10px] text-slate-400">CC GateGuard ops (rfeldman@gateguard.co)</span>
              </label>

              {emailResult && (
                <div className={`rounded-lg px-3 py-2.5 text-[10px] leading-relaxed border ${
                  emailResult.ok
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}>
                  {emailResult.msg}
                </div>
              )}

              <button
                onClick={handleEmail}
                disabled={sending || !emailTo.trim() || (template === 'custom' && !customSubject.trim())}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-[11px] font-bold text-white transition-all"
              >
                {sending ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    Sending…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/>
                    </svg>
                    Send Email
                  </>
                )}
              </button>
            </div>
          )}

          {/* ── LOG TAB ─────────────────────────────────────────────────────── */}
          {tab === 'log' && (
            <div className="max-w-lg space-y-5">
              <div>
                <h2 className="text-[13px] font-bold text-white mb-1">Activity Log</h2>
                <p className="text-[10px] text-slate-500">
                  All calls, emails, and notes for <span className="text-slate-300">{selectedSite?.name ?? 'this site'}</span>. Add a note below.
                </p>
              </div>

              {/* Add note */}
              <div className="space-y-2">
                <textarea
                  value={logNote}
                  onChange={e => setLogNote(e.target.value)}
                  placeholder="Add an activity note… (e.g. Called property manager at 22:14, no answer)"
                  rows={3}
                  className="w-full bg-[#0a0c10] border border-white/[0.12] rounded-lg px-3 py-2 text-[11px] text-white placeholder-slate-600 focus:outline-none focus:border-slate-500/50 resize-none"
                />
                {logResult && (
                  <div className={`rounded px-3 py-1.5 text-[10px] border ${
                    logResult.ok
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-red-500/10 border-red-500/30 text-red-300'
                  }`}>
                    {logResult.msg}
                  </div>
                )}
                <button
                  onClick={handleLog}
                  disabled={logSaving || !logNote.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700/80 hover:bg-slate-700 disabled:opacity-50 text-[10px] font-bold text-white transition-all"
                >
                  {logSaving ? 'Saving…' : '+ Save Note'}
                </button>
              </div>

              {/* Activity timeline */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[8px] font-bold uppercase tracking-wider text-slate-600">Recent Activity</p>
                  <button onClick={loadLog} className="text-[8px] text-indigo-500 hover:text-indigo-400">Refresh</button>
                </div>

                {logLoading ? (
                  <div className="space-y-1.5">
                    {[1,2,3].map(i => <div key={i} className="h-10 rounded bg-white/[0.03] animate-pulse"/>)}
                  </div>
                ) : logEntries.length === 0 ? (
                  <p className="text-[10px] text-slate-600 text-center py-8">No activity yet for this site</p>
                ) : (
                  <div className="space-y-1.5">
                    {logEntries.map(entry => {
                      const icon   = entry.type === 'call' ? '📞' : entry.type === 'email' ? '✉️' : '📋';
                      const label  = entry.type === 'call'
                        ? `Called ${entry.to_number ?? ''}`
                        : entry.type === 'email'
                        ? `Email — ${entry.template?.replace(/_/g, ' ') ?? ''} → ${entry.to_email ?? ''}`
                        : entry.note ?? '';
                      const time   = new Date(entry.created_at).toLocaleString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      });
                      return (
                        <div key={entry.id} className="flex gap-2.5 px-3 py-2 rounded-lg border border-white/[0.05] bg-white/[0.02]">
                          <span className="text-[13px] shrink-0 mt-0.5">{icon}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] text-slate-200 leading-snug">{label}</p>
                            <p className="text-[8px] text-slate-600 mt-0.5">{entry.operator_name} · {time}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ── Dialer modal (quick-dial from contact list) ──────────────────────── */}
      {dialerModal && (
        <DialerModal
          {...dialerModal}
          operatorName={operatorName}
          operatorId={operatorId ?? undefined}
          onClose={() => setDialerModal(null)}
        />
      )}

    </div>
  );
}
