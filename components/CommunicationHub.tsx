'use client';

// components/CommunicationHub.tsx
//
// Shared Communications panel — Dial / Email / Log tabs.
// Used from both Alarms page (process-gated) and Patrol page (always open).
//
// Props:
//   incidentId  — Supabase incident_reports.id (null on patrol)
//   patrolId    — Supabase patrol_reports.id (null on alarms)
//   zoneId      — current zone for DB context
//   contacts    — zone contacts for recipient picker
//   agentEmail  — from Clerk useUser
//   agentName   — from Clerk useUser
//   isLocked    — true = comms locked (alarm not yet processed)
//
// All comms are logged to calls / emails_sent / manual_logs via Supabase.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Types ────────────────────────────────────────────────────────────────────
type CommTab = 'dial' | 'email' | 'log';

type EmailType = 'incident_report' | 'gate_stuck_site' | 'gate_stuck_ops' | 'one_off';

interface Contact {
  id:    string;
  name:  string;
  phone: string | null;
  email: string | null;
  role:  string;
}

interface CallLog {
  id:               string;
  created_at:       string;
  to_name:          string | null;
  to_role:          string | null;
  to_number:        string;
  outcome:          string | null;
  duration_seconds: number | null;
  ai_summary:       string | null;
  agent_note:       string | null;
}

interface EmailLog {
  id:            string;
  created_at:    string;
  template_type: string;
  priority:      string | null;
  recipients:    { name: string; email: string; role?: string }[];
  subject:       string;
  body_preview:  string | null;
  status:        string;
}

interface ManualLog {
  id:          string;
  created_at:  string;
  agent_email: string;
  body:        string;
}

type LogEntry =
  | { type: 'call';   data: CallLog;   ts: string }
  | { type: 'email';  data: EmailLog;  ts: string }
  | { type: 'manual'; data: ManualLog; ts: string };

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  incidentId: string | null;
  patrolId:   string | null;
  zoneId:     string | null;
  contacts:   Contact[];
  agentEmail: string;
  agentName:  string;
  isLocked:   boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour:   '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function fmtDuration(s: number | null) {
  if (!s) return '';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

const OUTCOME_LABEL: Record<string, { label: string; color: string }> = {
  answered:    { label: 'Answered',  color: 'text-emerald-400' },
  'no-answer': { label: 'No Answer', color: 'text-amber-400'   },
  voicemail:   { label: 'Voicemail', color: 'text-sky-400'     },
  busy:        { label: 'Busy',      color: 'text-orange-400'  },
  failed:      { label: 'Failed',    color: 'text-red-400'     },
  'in-progress': { label: 'Active',  color: 'text-indigo-400'  },
};

const EMAIL_TYPE_LABEL: Record<EmailType, string> = {
  incident_report:  'Incident Report',
  gate_stuck_site:  'Gate Stuck (Site)',
  gate_stuck_ops:   'Gate Stuck (Ops)',
  one_off:          'One-Off Message',
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function CommunicationHub({
  incidentId,
  patrolId,
  zoneId,
  contacts,
  agentEmail,
  agentName,
  isLocked,
}: Props) {
  const [tab, setTab] = useState<CommTab>('dial');

  // ── Dial state ──────────────────────────────────────────────────────────────
  const [callTarget, setCallTarget]     = useState<Contact | null>(null);
  const [manualNumber, setManualNumber] = useState('');
  const [callStatus, setCallStatus]     = useState<'idle' | 'calling' | 'active' | 'ended'>('idle');
  const [callLogId, setCallLogId]       = useState<string | null>(null);
  const [callTimer, setCallTimer]       = useState(0);
  const [callNote, setCallNote]         = useState('');
  const [savingNote, setSavingNote]     = useState(false);
  const [aiSummary, setAiSummary]       = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Twilio Device — loaded dynamically to avoid SSR issues
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const twilioDeviceRef = useRef<any>(null);

  // ── Email state ─────────────────────────────────────────────────────────────
  const [emailType, setEmailType]         = useState<EmailType>('one_off');
  const [emailSubject, setEmailSubject]   = useState('');
  const [emailBody, setEmailBody]         = useState('');
  const [emailTo, setEmailTo]             = useState<string[]>([]);   // contact IDs
  const [extraEmail, setExtraEmail]       = useState('');
  const [sending, setSending]             = useState(false);
  const [sendResult, setSendResult]       = useState<{ ok: boolean; msg: string } | null>(null);

  // ── Log state ───────────────────────────────────────────────────────────────
  const [logEntries, setLogEntries]     = useState<LogEntry[]>([]);
  const [logNote, setLogNote]           = useState('');
  const [addingNote, setAddingNote]     = useState(false);
  const [loadingLog, setLoadingLog]     = useState(false);

  // ── Load log ────────────────────────────────────────────────────────────────
  const loadLog = useCallback(async () => {
    if (!incidentId && !patrolId) return;
    setLoadingLog(true);
    try {
      const filter = incidentId
        ? { col: 'incident_id', val: incidentId }
        : { col: 'patrol_id',   val: patrolId! };

      const [callsRes, emailsRes, notesRes] = await Promise.all([
        supabase.from('calls').select('*').eq(filter.col, filter.val).order('created_at', { ascending: false }),
        supabase.from('emails_sent').select('*').eq(filter.col, filter.val).order('created_at', { ascending: false }),
        supabase.from('manual_logs').select('*').eq(filter.col, filter.val).order('created_at', { ascending: false }),
      ]);

      const entries: LogEntry[] = [
        ...(callsRes.data  ?? []).map(d => ({ type: 'call'   as const, data: d as CallLog,   ts: d.created_at })),
        ...(emailsRes.data ?? []).map(d => ({ type: 'email'  as const, data: d as EmailLog,  ts: d.created_at })),
        ...(notesRes.data  ?? []).map(d => ({ type: 'manual' as const, data: d as ManualLog, ts: d.created_at })),
      ];
      entries.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
      setLogEntries(entries);
    } finally {
      setLoadingLog(false);
    }
  }, [incidentId, patrolId]);

  useEffect(() => {
    if (tab === 'log') loadLog();
  }, [tab, loadLog]);

  // ── Twilio device init ──────────────────────────────────────────────────────
  useEffect(() => {
    if (isLocked) return;
    let device: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    (async () => {
      try {
        const { Device } = await import('@twilio/voice-sdk');
        const res   = await fetch('/api/twilio/token');
        const { token } = await res.json();
        device = new Device(token, { logLevel: 1 });
        device.register();
        twilioDeviceRef.current = device;
      } catch (err) {
        console.warn('[CommunicationHub] Twilio init failed:', err);
      }
    })();
    return () => {
      device?.destroy();
    };
  }, [isLocked]);

  // ── Start call ──────────────────────────────────────────────────────────────
  async function startCall() {
    const toNumber = callTarget?.phone ?? manualNumber.trim();
    const toName   = callTarget?.name  ?? 'Manual';
    const toRole   = callTarget?.role  ?? '';
    if (!toNumber) return;

    setCallStatus('calling');
    setCallTimer(0);
    setAiSummary(null);
    setCallNote('');

    try {
      // Log the call start to Supabase
      const res  = await fetch('/api/twilio/call', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ toNumber, toName, toRole, agentEmail, incidentId, patrolId, zoneId }),
      });
      const { callLogId: logId } = await res.json();
      setCallLogId(logId);

      // Place the call via Twilio Device
      const device = twilioDeviceRef.current;
      if (device) {
        const conn = await device.connect({
          params: { To: toNumber, callLogId: logId },
        });

        conn.on('accept',     () => {
          setCallStatus('active');
          timerRef.current = setInterval(() => setCallTimer(t => t + 1), 1000);
        });
        conn.on('disconnect', () => endCall(logId));
        conn.on('error',      () => endCall(logId));
      } else {
        // Dev mode without real Twilio — simulate active call
        setCallStatus('active');
        timerRef.current = setInterval(() => setCallTimer(t => t + 1), 1000);
      }
    } catch (err) {
      console.error('[CommunicationHub] startCall error:', err);
      setCallStatus('idle');
    }
  }

  function endCall(logId?: string | null) {
    if (timerRef.current) clearInterval(timerRef.current);
    twilioDeviceRef.current?.disconnectAll?.();
    setCallStatus('ended');
    // Poll for AI summary
    const id = logId ?? callLogId;
    if (id) pollForSummary(id);
  }

  async function pollForSummary(id: string) {
    // Poll every 3s for up to 30s waiting for AI summary
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      const { data } = await supabase.from('calls').select('ai_summary').eq('id', id).single();
      if (data?.ai_summary) {
        setAiSummary(data.ai_summary);
        clearInterval(poll);
      }
      if (attempts >= 10) clearInterval(poll);
    }, 3000);
  }

  async function saveCallNote() {
    if (!callLogId || !callNote.trim()) return;
    setSavingNote(true);
    await supabase.from('calls').update({ agent_note: callNote.trim() }).eq('id', callLogId);
    setSavingNote(false);
  }

  // ── Send email ──────────────────────────────────────────────────────────────
  async function sendEmail() {
    if (!emailSubject.trim() || !emailBody.trim()) return;

    const recipientContacts = contacts
      .filter(c => emailTo.includes(c.id) && c.email)
      .map(c => ({ name: c.name, email: c.email!, role: c.role }));

    if (extraEmail.trim()) {
      recipientContacts.push({ name: '', email: extraEmail.trim(), role: 'Other' });
    }

    if (!recipientContacts.length) {
      setSendResult({ ok: false, msg: 'Add at least one recipient' });
      return;
    }

    setSending(true);
    setSendResult(null);

    // Wrap body in GateGuard branded template
    const htmlBody = buildEmailTemplate({
      emailType,
      subject:   emailSubject,
      body:      emailBody,
      agentName,
      agentEmail,
    });

    try {
      const res = await fetch('/api/reports/send-email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          templateType: emailType,
          priority:     null,
          subject:      emailSubject,
          htmlBody,
          recipients:   recipientContacts,
          agentEmail,
          agentName,
          incidentId,
          patrolId,
          zoneId,
          bodyPreview:  emailBody.slice(0, 500),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSendResult({ ok: true, msg: 'Email sent successfully' });
        setEmailSubject('');
        setEmailBody('');
        setEmailTo([]);
        setExtraEmail('');
      } else {
        setSendResult({ ok: false, msg: data.error ?? 'Send failed' });
      }
    } catch {
      setSendResult({ ok: false, msg: 'Network error — email not sent' });
    } finally {
      setSending(false);
    }
  }

  // ── Add manual log ──────────────────────────────────────────────────────────
  async function addManualNote() {
    if (!logNote.trim()) return;
    setAddingNote(true);
    await supabase.from('manual_logs').insert({
      incident_id: incidentId ?? null,
      patrol_id:   patrolId   ?? null,
      zone_id:     zoneId     ?? null,
      agent_email: agentEmail,
      body:        logNote.trim(),
    });
    setLogNote('');
    setAddingNote(false);
    loadLog();
  }

  // ── Locked state ─────────────────────────────────────────────────────────────
  if (isLocked) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-4 text-center">
        <div className="w-6 h-6 text-slate-700">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <p className="text-[9px] text-slate-600 uppercase tracking-wider leading-relaxed">
          Process alarm to unlock communications
        </p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Tab bar */}
      <div className="flex border-b border-white/[0.06] shrink-0">
        {([
          { key: 'dial',  label: 'Dial'  },
          { key: 'email', label: 'Email' },
          { key: 'log',   label: 'Log'   },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 text-[9px] font-semibold uppercase tracking-wider transition-all ${
              tab === t.key
                ? 'text-indigo-300 border-b-2 border-indigo-500 -mb-px'
                : 'text-slate-600 hover:text-slate-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">

        {/* ── DIAL TAB ── */}
        {tab === 'dial' && (
          <>
            {/* Contact picker */}
            {callStatus === 'idle' || callStatus === 'ended' ? (
              <>
                {callStatus === 'ended' && (
                  <div className="rounded border border-white/[0.06] bg-white/[0.02] p-2.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-slate-600" />
                      <p className="text-[10px] font-semibold text-slate-300">Call ended · {fmtDuration(callTimer)}</p>
                    </div>
                    {aiSummary ? (
                      <div className="space-y-1">
                        <p className="text-[8px] text-violet-400 uppercase tracking-wider font-bold">AI Summary</p>
                        <p className="text-[9px] text-slate-300 leading-relaxed">{aiSummary}</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 border border-violet-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-[9px] text-slate-500">Generating AI summary…</p>
                      </div>
                    )}
                    <textarea
                      value={callNote}
                      onChange={e => setCallNote(e.target.value)}
                      placeholder="Add a call note…"
                      rows={2}
                      className="w-full bg-white/[0.02] border border-white/[0.06] rounded px-2 py-1.5 text-[9px] text-slate-300 placeholder-slate-600 resize-none focus:outline-none focus:border-indigo-500/40"
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={saveCallNote}
                        disabled={savingNote || !callNote.trim()}
                        className="flex-1 py-1 rounded text-[9px] font-semibold bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-300 transition-all disabled:opacity-40"
                      >
                        {savingNote ? 'Saving…' : 'Save Note'}
                      </button>
                      <button
                        onClick={() => { setCallStatus('idle'); setCallLogId(null); }}
                        className="px-3 py-1 rounded text-[9px] font-semibold bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-400 transition-all"
                      >
                        New Call
                      </button>
                    </div>
                  </div>
                )}

                {callStatus === 'idle' && (
                  <>
                    {/* Contacts list */}
                    {contacts.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[8px] text-slate-600 uppercase tracking-wider mb-1">Zone Contacts</p>
                        {contacts.filter(c => c.phone).map(c => (
                          <button
                            key={c.id}
                            onClick={() => setCallTarget(c)}
                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded border transition-all text-left ${
                              callTarget?.id === c.id
                                ? 'border-indigo-500/40 bg-indigo-600/10'
                                : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold text-white truncate">{c.name}</p>
                              <p className="text-[8px] text-slate-500">{c.role} · {c.phone}</p>
                            </div>
                            {callTarget?.id === c.id && (
                              <div className="w-3 h-3 shrink-0 text-indigo-400">
                                <svg fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Manual number */}
                    <div>
                      <p className="text-[8px] text-slate-600 uppercase tracking-wider mb-1">
                        {contacts.filter(c => c.phone).length > 0 ? 'Or dial manually' : 'Dial number'}
                      </p>
                      <input
                        type="tel"
                        value={manualNumber}
                        onChange={e => { setManualNumber(e.target.value); setCallTarget(null); }}
                        placeholder="+1 (555) 000-0000"
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2.5 py-2 text-[10px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                      />
                    </div>

                    <button
                      onClick={startCall}
                      disabled={!callTarget?.phone && !manualNumber.trim()}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded font-semibold text-[10px] uppercase tracking-wider transition-all bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-300 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 7V5z" />
                      </svg>
                      Call {callTarget ? callTarget.name : 'Number'}
                    </button>
                  </>
                )}
              </>
            ) : (
              /* Active / calling state */
              <div className="flex flex-col items-center gap-4 py-4">
                <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center ${
                  callStatus === 'calling' ? 'border-amber-500/40 bg-amber-500/10 animate-pulse' : 'border-emerald-500/40 bg-emerald-500/10'
                }`}>
                  <svg className={`w-6 h-6 ${callStatus === 'calling' ? 'text-amber-400' : 'text-emerald-400'}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 7V5z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-[12px] font-bold text-white">
                    {callTarget?.name ?? manualNumber}
                  </p>
                  {callTarget?.role && (
                    <p className="text-[9px] text-slate-500">{callTarget.role}</p>
                  )}
                  <p className={`text-[9px] mt-1 font-mono ${callStatus === 'calling' ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {callStatus === 'calling' ? 'Connecting…' : fmtDuration(callTimer)}
                  </p>
                </div>
                <button
                  onClick={() => endCall()}
                  className="flex items-center gap-2 px-5 py-2 rounded-full bg-red-600/30 hover:bg-red-600/50 border border-red-500/40 text-red-400 hover:text-red-300 text-[10px] font-bold uppercase tracking-wider transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.129a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
                  </svg>
                  End Call
                </button>
              </div>
            )}
          </>
        )}

        {/* ── EMAIL TAB ── */}
        {tab === 'email' && (
          <>
            {/* Template type selector */}
            <div>
              <p className="text-[8px] text-slate-600 uppercase tracking-wider mb-1">Message Type</p>
              <div className="grid grid-cols-2 gap-1">
                {(['one_off', 'gate_stuck_site', 'gate_stuck_ops'] as EmailType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setEmailType(t)}
                    className={`py-1.5 px-2 rounded border text-[9px] font-medium transition-all text-left ${
                      emailType === t
                        ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                        : 'bg-white/[0.02] border-white/[0.06] text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {EMAIL_TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* Recipients */}
            <div>
              <p className="text-[8px] text-slate-600 uppercase tracking-wider mb-1">To</p>
              <div className="space-y-1">
                {contacts.filter(c => c.email).map(c => (
                  <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded border border-white/[0.04] hover:bg-white/[0.02] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailTo.includes(c.id)}
                      onChange={e => setEmailTo(prev =>
                        e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id)
                      )}
                      className="w-3 h-3 accent-indigo-500"
                    />
                    <div className="min-w-0">
                      <p className="text-[9px] font-semibold text-white truncate">{c.name}</p>
                      <p className="text-[8px] text-slate-500 truncate">{c.role} · {c.email}</p>
                    </div>
                  </label>
                ))}
                <input
                  type="email"
                  value={extraEmail}
                  onChange={e => setExtraEmail(e.target.value)}
                  placeholder="Add email address…"
                  className="w-full bg-white/[0.02] border border-white/[0.06] rounded px-2 py-1.5 text-[9px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/40"
                />
              </div>
            </div>

            {/* Subject */}
            <div>
              <p className="text-[8px] text-slate-600 uppercase tracking-wider mb-1">Subject</p>
              <input
                type="text"
                value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)}
                placeholder="Email subject…"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2.5 py-2 text-[10px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            {/* Body */}
            <div>
              <p className="text-[8px] text-slate-600 uppercase tracking-wider mb-1">
                Message body
                {emailType !== 'one_off' && (
                  <span className="ml-2 text-indigo-400 normal-case">GateGuard template will wrap this</span>
                )}
              </p>
              <textarea
                value={emailBody}
                onChange={e => setEmailBody(e.target.value)}
                placeholder="Write your message…"
                rows={5}
                className="w-full bg-white/[0.02] border border-white/[0.06] rounded px-2.5 py-2 text-[9px] text-slate-300 placeholder-slate-600 resize-none focus:outline-none focus:border-indigo-500/40"
              />
            </div>

            {sendResult && (
              <p className={`text-[9px] px-1 ${sendResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                {sendResult.ok ? '✓ ' : '✗ '}{sendResult.msg}
              </p>
            )}

            <button
              onClick={sendEmail}
              disabled={sending || !emailSubject.trim() || !emailBody.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {sending ? (
                <><div className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" /> Sending…</>
              ) : (
                <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg> Send Email</>
              )}
            </button>
          </>
        )}

        {/* ── LOG TAB ── */}
        {tab === 'log' && (
          <>
            {/* Add note */}
            <div className="flex gap-1.5">
              <input
                type="text"
                value={logNote}
                onChange={e => setLogNote(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addManualNote(); } }}
                placeholder="Add note to log…"
                className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded px-2.5 py-2 text-[10px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
              />
              <button
                onClick={addManualNote}
                disabled={addingNote || !logNote.trim()}
                className="px-3 py-2 rounded border border-indigo-500/30 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 text-[9px] font-bold uppercase tracking-wider transition-all disabled:opacity-40"
              >
                {addingNote ? '…' : 'Add'}
              </button>
            </div>

            {/* Timeline */}
            {loadingLog ? (
              <div className="flex justify-center py-4">
                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : logEntries.length === 0 ? (
              <p className="text-[9px] text-slate-600 text-center py-4">No communications logged yet</p>
            ) : (
              <div className="space-y-2">
                {logEntries.map(entry => (
                  <LogEntryCard key={entry.data.id} entry={entry} />
                ))}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}

// ─── Log entry card ───────────────────────────────────────────────────────────
function LogEntryCard({ entry }: { entry: LogEntry }) {
  if (entry.type === 'call') {
    const d  = entry.data;
    const oc = OUTCOME_LABEL[d.outcome ?? ''] ?? { label: d.outcome ?? '—', color: 'text-slate-400' };
    return (
      <div className="rounded border border-white/[0.06] bg-white/[0.02] p-2.5 space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 7V5z" />
            </svg>
            <p className="text-[9px] font-semibold text-white">{d.to_name ?? d.to_number}</p>
            {d.to_role && <p className="text-[8px] text-slate-500">{d.to_role}</p>}
          </div>
          <p className="text-[8px] text-slate-600 font-mono">{fmtTime(entry.ts)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[8px] font-semibold ${oc.color}`}>{oc.label}</span>
          {d.duration_seconds != null && (
            <span className="text-[8px] text-slate-600">{fmtDuration(d.duration_seconds)}</span>
          )}
        </div>
        {d.ai_summary && (
          <p className="text-[8px] text-slate-400 leading-relaxed border-t border-white/[0.04] pt-1">
            <span className="text-violet-500 font-semibold">AI: </span>{d.ai_summary}
          </p>
        )}
        {d.agent_note && (
          <p className="text-[8px] text-slate-500 italic">{d.agent_note}</p>
        )}
      </div>
    );
  }

  if (entry.type === 'email') {
    const d = entry.data;
    return (
      <div className="rounded border border-white/[0.06] bg-white/[0.02] p-2.5 space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <svg className="w-3 h-3 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="text-[9px] font-semibold text-white truncate max-w-[140px]">{d.subject}</p>
          </div>
          <p className="text-[8px] text-slate-600 font-mono shrink-0">{fmtTime(entry.ts)}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[8px] text-slate-500">
            {EMAIL_TYPE_LABEL[d.template_type as EmailType] ?? d.template_type}
          </span>
          {d.priority && <span className="text-[8px] font-bold text-amber-400">{d.priority}</span>}
          <span className={`text-[8px] font-semibold ${d.status === 'sent' ? 'text-emerald-400' : 'text-red-400'}`}>
            {d.status === 'sent' ? '✓ Sent' : '✗ Failed'}
          </span>
        </div>
        {d.recipients?.length > 0 && (
          <p className="text-[8px] text-slate-600">
            To: {d.recipients.map((r: { name: string; email: string }) => r.name || r.email).join(', ')}
          </p>
        )}
      </div>
    );
  }

  // manual log
  const d = entry.data;
  return (
    <div className="rounded border border-white/[0.04] bg-white/[0.01] px-2.5 py-2 flex items-start gap-2">
      <svg className="w-2.5 h-2.5 text-slate-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] text-slate-300 leading-relaxed">{d.body}</p>
        <p className="text-[8px] text-slate-600 mt-0.5">{fmtTime(entry.ts)}</p>
      </div>
    </div>
  );
}

// ─── Email template builder ───────────────────────────────────────────────────
function buildEmailTemplate({
  emailType, subject, body, agentName, agentEmail,
}: {
  emailType: EmailType;
  subject:   string;
  body:      string;
  agentName: string;
  agentEmail: string;
}) {
  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${subject}</title>
<style>
  body { margin:0; padding:0; background:#f4f4f4; font-family:'Helvetica Neue',Arial,sans-serif; }
  .wrapper { max-width:640px; margin:32px auto; background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.08); }
  .header { background:#0f172a; padding:24px 32px; }
  .header-logo { font-size:20px; font-weight:700; color:#ffffff; letter-spacing:-0.5px; }
  .header-logo span { color:#6366f1; }
  .header-badge { display:inline-block; margin-top:8px; padding:2px 10px; border-radius:4px; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#94a3b8; border:1px solid #334155; }
  .body { padding:32px; color:#334155; }
  .subject { font-size:20px; font-weight:700; color:#0f172a; margin:0 0 8px; }
  .meta { font-size:12px; color:#94a3b8; margin-bottom:24px; }
  .divider { border:none; border-top:1px solid #e2e8f0; margin:24px 0; }
  .content { font-size:14px; line-height:1.7; color:#475569; white-space:pre-wrap; }
  .footer { background:#f8fafc; padding:20px 32px; border-top:1px solid #e2e8f0; }
  .footer-agent { font-size:12px; font-weight:600; color:#475569; }
  .footer-contact { font-size:11px; color:#94a3b8; margin-top:2px; }
  .footer-legal { font-size:10px; color:#cbd5e1; margin-top:12px; line-height:1.5; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <div class="header-logo">Gate<span>Guard</span></div>
    <div class="header-badge">Confidential · Dispatch Communication</div>
  </div>
  <div class="body">
    <p class="subject">${subject}</p>
    <p class="meta">${dateStr} at ${timeStr}</p>
    <hr class="divider" />
    <div class="content">${body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
  </div>
  <div class="footer">
    <p class="footer-agent">${agentName}</p>
    <p class="footer-contact">GateGuard Dispatch · ${agentEmail}</p>
    <p class="footer-legal">
      This communication is intended solely for the named recipient(s) and may contain confidential
      information. If you have received this in error, please notify GateGuard immediately and delete
      this message. Unauthorized use, disclosure, or distribution is prohibited.
    </p>
  </div>
</div>
</body>
</html>`;
}
