// components/DialerModal.tsx
// Small in-app Twilio dialer — replaces tel: links so calls never
// hand off to RingCentral / system phone app.
//
// Usage:
//   const [dialerTarget, setDialerTarget] = useState<DialerTarget|null>(null);
//   <button onClick={() => setDialerTarget({ phone, name, siteName })}>📞</button>
//   {dialerTarget && <DialerModal {...dialerTarget} operatorName={operatorName} onClose={() => setDialerTarget(null)} />}

'use client';

import { useState } from 'react';

export interface DialerTarget {
  phone:       string;
  name?:       string;
  siteName?:   string;
  alarmId?:    string;
  patrolLogId?: string;
}

interface Props extends DialerTarget {
  operatorName?: string;
  operatorId?:   string;
  onClose:       () => void;
}

type CallState = 'idle' | 'calling' | 'success' | 'error';

export default function DialerModal({
  phone,
  name,
  siteName,
  alarmId,
  patrolLogId,
  operatorName = 'Operator',
  operatorId,
  onClose,
}: Props) {
  const [number,    setNumber]    = useState(phone);
  const [callState, setCallState] = useState<CallState>('idle');
  const [message,   setMessage]   = useState('');

  async function dial() {
    if (!number.trim()) return;
    setCallState('calling');
    setMessage('');
    try {
      const res = await fetch('/api/comms/call', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          toNumber:     number.trim(),
          siteName:     siteName ?? '',
          alarmId:      alarmId ?? null,
          patrolLogId:  patrolLogId ?? null,
          operatorId:   operatorId ?? null,
          operatorName,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCallState('error');
        setMessage(json.error ?? 'Call failed');
      } else {
        setCallState('success');
        setMessage('Call initiated — GateGuard 844 will ring the contact shortly.');
      }
    } catch (err: any) {
      setCallState('error');
      setMessage(err.message ?? 'Network error');
    }
  }

  return (
    /* backdrop */
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-80 rounded-2xl border border-white/10 bg-[#0d1117] shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07] bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 6.75z" />
              </svg>
            </div>
            <span className="text-[11px] font-bold text-white tracking-wide">GateGuard Dialer</span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-white hover:bg-white/[0.08] transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">

          {/* Contact info */}
          {(name || siteName) && (
            <div className="rounded-lg bg-white/[0.03] border border-white/[0.07] px-3 py-2.5">
              {name && <p className="text-[11px] font-semibold text-white">{name}</p>}
              {siteName && <p className="text-[9px] text-slate-500 mt-0.5">{siteName}</p>}
            </div>
          )}

          {/* Number input */}
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Number
            </label>
            <input
              type="tel"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              disabled={callState === 'calling' || callState === 'success'}
              placeholder="+1 555 000 0000"
              className="w-full bg-[#0a0c10] border border-white/[0.12] rounded-lg px-3 py-2 text-[13px] font-mono text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 disabled:opacity-50"
            />
          </div>

          {/* Caller ID note */}
          <p className="text-[9px] text-slate-600">
            Caller ID shown to recipient: <span className="text-slate-400 font-mono">GateGuard 844</span>
          </p>

          {/* Status message */}
          {message && (
            <div className={`rounded-lg px-3 py-2 text-[10px] leading-relaxed border ${
              callState === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}>
              {message}
            </div>
          )}

          {/* Actions */}
          {callState === 'success' ? (
            <div className="flex gap-2">
              <button
                onClick={() => { setCallState('idle'); setMessage(''); }}
                className="flex-1 py-2.5 rounded-lg border border-white/[0.10] text-[11px] font-bold text-slate-300 hover:bg-white/[0.05] transition-all"
              >
                Call Again
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-[11px] font-bold text-white transition-all"
              >
                Done
              </button>
            </div>
          ) : (
            <button
              onClick={dial}
              disabled={callState === 'calling' || !number.trim()}
              className="w-full py-3 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-[12px] font-bold text-white transition-all flex items-center justify-center gap-2"
            >
              {callState === 'calling' ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Connecting…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 6.75z" />
                  </svg>
                  Call via GateGuard
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
