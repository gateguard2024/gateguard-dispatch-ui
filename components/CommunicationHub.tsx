"use client";

// components/CommunicationHub.tsx
// Three-tab panel: Dial · Email · Log
// Shown in Alarms (process-gated) and Patrol (always available).

import React, { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
type HubTab = 'dial' | 'email' | 'log';

type EmailTemplate = 'incident_report' | 'gate_service' | 'check_in' | 'all_clear' | 'custom';

interface LogEntry {
  id:            string;
  operator_name: string;
  note:          string;
  created_at:    string;
}

interface CommunicationHubProps {
  alarmId?:            string;
  patrolLogId?:        string;
  siteName:            string;
  siteContactPhone?:   string | null;
  siteContactEmail?:   string | null;
  operatorId?:         string;
  operatorName:        string;
  priority?:           string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

const TEMPLATES: { value: EmailTemplate; label: string; desc: string }[] = [
  { value: 'incident_report', label: 'Incident Report',       desc: 'Full alarm summary to site + ops' },
  { value: 'gate_service',    label: 'Gate / Door Service',   desc: 'Service needed notification' },
  { value: 'check_in',        label: 'Patrol Check-In',       desc: 'Routine patrol status to site' },
  { value: 'all_clear',       label: 'All Clear',             desc: 'Confirm site is clear' },
  { value: 'custom',          label: 'Custom Message',        desc: 'Write your own subject + body' },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function CommunicationHub({
  alarmId,
  patrolLogId,
  siteName,
  siteContactPhone,
  siteContactEmail,
  operatorId,
  operatorName,
  priority = '',
}: CommunicationHubProps) {
  const [tab, setTab] = useState<HubTab>('dial');

  // ── Dial state ────────────────────────────────────────────────────────────
  const [phoneInput, setPhoneInput]   = useState(siteContactPhone ?? '');
  const [calling,    setCalling]      = useState(false);
  const [callResult, setCallResult]   = useState<{ ok: boolean; msg: string } | null>(null);

  // ── Email state ───────────────────────────────────────────────────────────
  const [emailTo,       setEmailTo]       = useState(siteContactEmail ?? '');
  const [template,      setTemplate]      = useState<EmailTemplate>('incident_report');
  const [emailNotes,    setEmailNotes]    = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [customBody,    setCustomBody]    = useState('');
  const [ccOps,         setCcOps]         = useState(true);
  const [sending,       setSending]       = useState(false);
  const [emailResult,   setEmailResult]   = useState<{ ok: boolean; msg: string } | null>(null);

  // ── Log state ─────────────────────────────────────────────────────────────
  const [logNote,    setLogNote]    = useState('');
  const [saving,     setSaving]     = useState(false);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);

  // Load log history when tab switches to log
  const loadLogs = useCallback(async () => {
    const params = new URLSearchParams();
    if (alarmId)     params.set('alarmId', alarmId);
    if (patrolLogId) params.set('patrolLogId', patrolLogId);
    if (!alarmId && !patrolLogId) return;
    const res = await fetch(`/api/comms/log?${params}`);
    if (res.ok) {
      const { entries } = await res.json();
      setLogEntries(entries ?? []);
      setLogsLoaded(true);
    }
  }, [alarmId, patrolLogId]);

  useEffect(() => {
    if (tab === 'log' && !logsLoaded) loadLogs();
  }, [tab, logsLoaded, loadLogs]);

  // ── Actions ────────────────────────────────────────────────────────────────
  async function handleCall() {
    if (!phoneInput.trim()) return;
    setCalling(true);
    setCallResult(null);
    try {
      const res = await fetch('/api/comms/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toNumber:     phoneInput.trim(),
          siteName,
          alarmId:      alarmId ?? null,
          patrolLogId:  patrolLogId ?? null,
          operatorId,
          operatorName,
        }),
      });
      const data = await res.json();
      setCallResult(
        data.success
          ? { ok: true,  msg: `Call initiated — SID: ${data.sid?.slice(0, 16)}…` }
          : { ok: false, msg: data.error ?? 'Call failed' }
      );
    } catch (err: any) {
      setCallResult({ ok: false, msg: err.message });
    } finally {
      setCalling(false);
    }
  }

  async function handleEmail() {
    if (!emailTo.trim()) return;
    setSending(true);
    setEmailResult(null);
    try {
      const res = await fetch('/api/comms/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to:           emailTo.trim(),
          template,
          siteName,
          operatorName,
          alarmId:      alarmId ?? '',
          patrolLogId:  patrolLogId ?? null,
          operatorId,
          notes:        emailNotes,
          priority,
          ccOps,
          customSubject: template === 'custom' ? customSubject : undefined,
          customBody:    template === 'custom' ? customBody    : undefined,
        }),
      });
      const data = await res.json();
      setEmailResult(
        data.sent
          ? { ok: true,  msg: 'Email sent ✓' }
          : { ok: false, msg: data.error ?? 'Send failed' }
      );
      if (data.sent) { setEmailNotes(''); setCustomSubject(''); setCustomBody(''); }
    } catch (err: any) {
      setEmailResult({ ok: false, msg: err.message });
    } finally {
      setSending(false);
    }
  }

  async function handleLog() {
    if (!logNote.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/comms/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note:        logNote.trim(),
          alarmId:     alarmId ?? null,
          patrolLogId: patrolLogId ?? null,
          operatorId,
          operatorName,
          siteName,
        }),
      });
      if (res.ok) {
        setLogNote('');
        loadLogs();
      }
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Tab bar */}
      <div className="flex items-center gap-0.5 px-3 pt-3 pb-0">
        {(['dial', 'email', 'log'] as HubTab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-t text-[9px] font-bold uppercase tracking-wider transition-all border-b-2 ${
              tab === t
                ? t === 'dial'  ? 'border-indigo-500 text-indigo-300 bg-indigo-500/10'
                : t === 'email' ? 'border-violet-500 text-violet-300 bg-violet-500/10'
                :                 'border-slate-500  text-slate-300  bg-slate-500/10'
                : 'border-transparent text-slate-600 hover:text-slate-400'
            }`}
          >
            {t === 'dial' ? '📞 Dial' : t === 'email' ? '✉ Email' : '📝 Log'}
          </button>
        ))}
      </div>

      {/* Panel body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">

        {/* ── DIAL TAB ───────────────────────────────────────────────────── */}
        {tab === 'dial' && (
          <>
            <p className="text-[9px] text-slate-600 uppercase tracking-wider">Outbound call to site contact</p>

            {/* Phone input */}
            <div className="flex gap-1.5">
              <input
                type="tel"
                value={phoneInput}
                onChange={e => setPhoneInput(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded px-2.5 py-2 text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 font-mono"
              />
              <button
                onClick={handleCall}
                disabled={calling || !phoneInput.trim()}
                className="px-3 py-2 rounded border border-indigo-500/40 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-[10px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {calling
                  ? <span className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 5.25v1.5z" />
                    </svg>}
                {calling ? 'Calling…' : 'Call'}
              </button>
            </div>

            {/* Result */}
            {callResult && (
              <div className={`text-[10px] px-3 py-2 rounded border ${
                callResult.ok
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-red-500/30 bg-red-500/10 text-red-300'
              }`}>
                {callResult.msg}
              </div>
            )}

            {/* Info */}
            <div className="text-[9px] text-slate-700 leading-relaxed space-y-1">
              <p>Calls display your GateGuard 844 number as caller ID.</p>
              <p>Recipient hears a professional notification message then hangs up automatically.</p>
              <p>All call attempts are logged in the activity record.</p>
            </div>
          </>
        )}

        {/* ── EMAIL TAB ──────────────────────────────────────────────────── */}
        {tab === 'email' && (
          <>
            <p className="text-[9px] text-slate-600 uppercase tracking-wider">Send email to site or ops</p>

            {/* To */}
            <input
              type="email"
              value={emailTo}
              onChange={e => setEmailTo(e.target.value)}
              placeholder="recipient@example.com"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2.5 py-2 text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-violet-500/50"
            />

            {/* Template picker */}
            <div className="space-y-1">
              {TEMPLATES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setTemplate(t.value)}
                  className={`w-full text-left px-2.5 py-2 rounded border transition-all ${
                    template === t.value
                      ? 'border-violet-500/50 bg-violet-500/15 text-violet-200'
                      : 'border-white/[0.06] bg-white/[0.02] text-slate-500 hover:text-slate-300 hover:border-white/[0.1]'
                  }`}
                >
                  <p className="text-[10px] font-semibold">{t.label}</p>
                  <p className="text-[9px] opacity-70 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>

            {/* Custom fields */}
            {template === 'custom' && (
              <>
                <input
                  type="text"
                  value={customSubject}
                  onChange={e => setCustomSubject(e.target.value)}
                  placeholder="Email subject…"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2.5 py-2 text-[10px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-violet-500/50"
                />
                <textarea
                  value={customBody}
                  onChange={e => setCustomBody(e.target.value)}
                  placeholder="Email body…"
                  rows={4}
                  className="w-full bg-white/[0.03] border border-white/[0.06] rounded px-2.5 py-2 text-[10px] text-slate-300 placeholder-slate-600 resize-none focus:outline-none focus:border-violet-500/40"
                />
              </>
            )}

            {/* Notes for non-custom */}
            {template !== 'custom' && (
              <textarea
                value={emailNotes}
                onChange={e => setEmailNotes(e.target.value)}
                placeholder="Add operator notes (included in email)…"
                rows={2}
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded px-2.5 py-2 text-[10px] text-slate-300 placeholder-slate-600 resize-none focus:outline-none focus:border-violet-500/40"
              />
            )}

            {/* CC ops toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={ccOps}
                onChange={e => setCcOps(e.target.checked)}
                className="w-3 h-3 accent-violet-500"
              />
              <span className="text-[9px] text-slate-500">CC operations (rfeldman@gateguard.co)</span>
            </label>

            {/* Result */}
            {emailResult && (
              <div className={`text-[10px] px-3 py-2 rounded border ${
                emailResult.ok
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-red-500/30 bg-red-500/10 text-red-300'
              }`}>
                {emailResult.msg}
              </div>
            )}

            {/* Send button */}
            <button
              onClick={handleEmail}
              disabled={sending || !emailTo.trim() || (template === 'custom' && !customSubject.trim())}
              className="w-full py-2 rounded border border-violet-500/40 bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {sending
                ? <span className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                : null}
              {sending ? 'Sending…' : 'Send Email'}
            </button>
          </>
        )}

        {/* ── LOG TAB ────────────────────────────────────────────────────── */}
        {tab === 'log' && (
          <>
            <p className="text-[9px] text-slate-600 uppercase tracking-wider">Operator activity log</p>

            {/* New note */}
            <div className="flex flex-col gap-1.5">
              <textarea
                value={logNote}
                onChange={e => setLogNote(e.target.value)}
                placeholder="Note action taken, contact made, status update…"
                rows={3}
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded px-2.5 py-2 text-[10px] text-slate-300 placeholder-slate-600 resize-none focus:outline-none focus:border-slate-500/50"
              />
              <button
                onClick={handleLog}
                disabled={saving || !logNote.trim()}
                className="w-full py-1.5 rounded border border-slate-500/30 bg-slate-500/10 hover:bg-slate-500/20 text-slate-300 text-[10px] font-semibold uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Save Note'}
              </button>
            </div>

            {/* Log history */}
            <div className="space-y-2 pt-1">
              {logEntries.length === 0 ? (
                <p className="text-[9px] text-slate-700 text-center py-4">No activity logged yet</p>
              ) : logEntries.map(entry => (
                <div key={entry.id} className="px-2.5 py-2 rounded border border-white/[0.04] bg-white/[0.01]">
                  <p className="text-[10px] text-slate-300 leading-relaxed">{entry.note}</p>
                  <p className="text-[8px] text-slate-600 mt-1">
                    {entry.operator_name} · {fmt(entry.created_at)}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
