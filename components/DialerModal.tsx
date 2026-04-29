// components/DialerModal.tsx
// Live two-way browser phone using Twilio Voice SDK (WebRTC).
// Operator speaks AND listens through the browser — no system phone handoff.
//
// Flow:
//   1. Mount → fetch Access Token from /api/comms/token
//   2. Init Twilio Device
//   3. Click "Call" → Device.connect({ params: { To: normalizedNumber } })
//   4. Twilio → voice-connect webhook → <Dial> to destination
//   5. If answered → live two-way audio
//   6. If no-answer → voice-fallback auto-dials to leave voicemail (callback 844-469-4283 x900)
//   7. Hang Up button ends the call
//
// Number formats accepted:
//   10 digits        → auto-prepend +1 (e.g. 5551234567 → +15551234567)
//   +1XXXXXXXXXX     → used as-is
//   1XXXXXXXXXX (11) → prepend +

'use client';

import { useEffect, useRef, useState } from 'react';
import type { Call, Device } from '@twilio/voice-sdk';

export interface DialerTarget {
  phone:        string;
  name?:        string;
  siteName?:    string;
  alarmId?:     string;
  patrolLogId?: string;
}

interface Props extends DialerTarget {
  operatorName?: string;
  operatorId?:   string;
  onClose:       () => void;
}

type Phase =
  | 'loading'        // fetching token / initialising Device
  | 'ready'          // Device ready — waiting for operator to call
  | 'connecting'     // Device.connect() fired, Twilio processing
  | 'ringing'        // ringing the other side
  | 'active'         // call answered — two-way audio live
  | 'ended'          // call ended cleanly
  | 'voicemail_sent' // no-answer → voicemail dispatched
  | 'error';         // something went wrong

// ─── Normalise a user-typed phone number to E.164 ────────────────────────────
function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10)                       return `+1${digits}`;
  if (digits.length === 11 && digits[0] === '1')  return `+${digits}`;
  if (digits.length > 10 && raw.startsWith('+'))  return raw.replace(/[^\d+]/g, '');
  return null;  // invalid
}

// ─── Duration timer ──────────────────────────────────────────────────────────
function useDuration(running: boolean) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!running) { setSecs(0); return; }
    const id = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

// ─── Phase helpers ────────────────────────────────────────────────────────────
const PHASE_LABEL: Record<Phase, string> = {
  loading:        'Initialising…',
  ready:          'Ready',
  connecting:     'Connecting…',
  ringing:        'Ringing…',
  active:         'Live Call',
  ended:          'Call Ended',
  voicemail_sent: 'Voicemail Left',
  error:          'Error',
};

const PHASE_COLOR: Record<Phase, string> = {
  loading:        'text-slate-400',
  ready:          'text-slate-400',
  connecting:     'text-amber-400',
  ringing:        'text-amber-400',
  active:         'text-emerald-400',
  ended:          'text-slate-500',
  voicemail_sent: 'text-indigo-400',
  error:          'text-red-400',
};

// ─── Main component ───────────────────────────────────────────────────────────
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
  const [number, setNumber] = useState(phone);
  const [phase,  setPhase]  = useState<Phase>('loading');
  const [errMsg, setErrMsg] = useState('');
  const [muted,  setMuted]  = useState(false);

  const deviceRef = useRef<Device | null>(null);
  const callRef   = useRef<Call | null>(null);

  const duration = useDuration(phase === 'active');

  // ── 1. Fetch token + init Device on mount ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const res  = await fetch('/api/comms/token');
        const json = await res.json();

        if (!res.ok || !json.token) {
          throw new Error(json.error ?? 'Could not get token');
        }

        if (cancelled) return;

        // Dynamically import Voice SDK (browser-only)
        const { Device: TwilioDevice } = await import('@twilio/voice-sdk');

        const device = new TwilioDevice(json.token, {
          logLevel:  'warn',
          codecPreferences: ['opus', 'pcmu'] as any,
        });

        device.on('ready',       () => { if (!cancelled) setPhase('ready'); });
        device.on('error',       (err: any) => {
          console.error('[dialer] Device error:', err);
          if (!cancelled) { setPhase('error'); setErrMsg(err.message ?? 'Device error'); }
        });
        device.on('disconnect',  () => {
          if (!cancelled) setPhase('ended');
          callRef.current = null;
        });

        await device.register();
        deviceRef.current = device;

        if (!cancelled) setPhase('ready');
      } catch (err: any) {
        console.error('[dialer] Init error:', err);
        if (!cancelled) { setPhase('error'); setErrMsg(err.message ?? 'Init failed'); }
      }
    }

    init();

    return () => {
      cancelled = true;
      callRef.current?.disconnect();
      callRef.current = null;
      deviceRef.current?.destroy();
      deviceRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 2. Place call ──────────────────────────────────────────────────────────
  async function dial() {
    if (!deviceRef.current) return;

    const e164 = toE164(number);
    if (!e164) {
      setPhase('error');
      setErrMsg('Enter a 10-digit US number or +1 followed by 10 digits.');
      return;
    }

    setPhase('connecting');
    setErrMsg('');

    try {
      const call = await deviceRef.current.connect({
        params: {
          To:       e164,
          Site:     siteName ?? '',
          Operator: operatorName,
        },
      });

      callRef.current = call;

      call.on('ringing', () => setPhase('ringing'));
      call.on('accept',  () => setPhase('active'));
      call.on('disconnect', () => {
        setPhase('ended');
        callRef.current = null;
      });
      call.on('error',   (err: any) => {
        console.error('[dialer] Call error:', err);
        setPhase('error');
        setErrMsg(err.message ?? 'Call error');
        callRef.current = null;
      });
    } catch (err: any) {
      console.error('[dialer] connect() error:', err);
      setPhase('error');
      setErrMsg(err.message ?? 'Could not connect call');
    }
  }

  // ── 3. Hang up ─────────────────────────────────────────────────────────────
  function hangUp() {
    callRef.current?.disconnect();
    callRef.current = null;
    setPhase('ended');
  }

  // ── 4. Toggle mute ─────────────────────────────────────────────────────────
  function toggleMute() {
    if (!callRef.current) return;
    const next = !muted;
    callRef.current.mute(next);
    setMuted(next);
  }

  // ── 5. Reset for another call ──────────────────────────────────────────────
  function reset() {
    setPhase(deviceRef.current ? 'ready' : 'loading');
    setErrMsg('');
    setMuted(false);
  }

  const isLive    = phase === 'active';
  const isBusy    = ['connecting', 'ringing', 'active'].includes(phase);
  const isDone    = ['ended', 'voicemail_sent'].includes(phase);
  const canDial   = phase === 'ready' && toE164(number) !== null;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !isBusy) onClose(); }}
    >
      <div className="w-80 rounded-2xl border border-white/10 bg-[#0d1117] shadow-2xl overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07] bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full border flex items-center justify-center transition-colors ${
              isLive
                ? 'bg-emerald-500/20 border-emerald-500/40'
                : 'bg-emerald-500/10 border-emerald-500/25'
            }`}>
              {isLive ? (
                /* sound wave icon while active */
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="3"  y="9"  width="2" height="6" rx="1"/>
                  <rect x="7"  y="6"  width="2" height="12" rx="1"/>
                  <rect x="11" y="4"  width="2" height="16" rx="1"/>
                  <rect x="15" y="6"  width="2" height="12" rx="1"/>
                  <rect x="19" y="9"  width="2" height="6" rx="1"/>
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 6.75z" />
                </svg>
              )}
            </div>
            <div>
              <p className="text-[11px] font-bold text-white tracking-wide">GateGuard Dialer</p>
              <p className={`text-[9px] font-semibold ${PHASE_COLOR[phase]}`}>
                {PHASE_LABEL[phase]}
                {isLive && <span className="ml-1 font-mono">{duration}</span>}
              </p>
            </div>
          </div>
          <button
            onClick={() => { if (!isBusy) { hangUp(); onClose(); } }}
            disabled={isBusy}
            className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-white hover:bg-white/[0.08] transition-all disabled:opacity-30"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">

          {/* ── Contact info ─────────────────────────────────────────── */}
          {(name || siteName) && (
            <div className="rounded-lg bg-white/[0.03] border border-white/[0.07] px-3 py-2.5">
              {name     && <p className="text-[11px] font-semibold text-white">{name}</p>}
              {siteName && <p className="text-[9px]  text-slate-500 mt-0.5">{siteName}</p>}
            </div>
          )}

          {/* ── Number input ─────────────────────────────────────────── */}
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Number — 10 digits or +1…
            </label>
            <input
              type="tel"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              disabled={isBusy || isDone}
              placeholder="8005551234 or +18005551234"
              className="w-full bg-[#0a0c10] border border-white/[0.12] rounded-lg px-3 py-2.5 text-[14px] font-mono text-white placeholder-slate-700 focus:outline-none focus:border-emerald-500/50 disabled:opacity-50 tracking-wider"
            />
          </div>

          {/* ── Caller ID note ───────────────────────────────────────── */}
          <p className="text-[9px] text-slate-600">
            Recipient sees: <span className="text-slate-400 font-mono">GateGuard 844</span>
            {' · '}Callback: <span className="text-slate-400 font-mono">844-469-4283 x900</span>
          </p>

          {/* ── Error message ────────────────────────────────────────── */}
          {phase === 'error' && errMsg && (
            <div className="rounded-lg px-3 py-2.5 text-[10px] leading-relaxed bg-red-500/10 border border-red-500/30 text-red-300">
              {errMsg}
            </div>
          )}

          {/* ── Post-call summary ────────────────────────────────────── */}
          {(phase === 'ended' || phase === 'voicemail_sent') && (
            <div className={`rounded-lg px-3 py-2.5 text-[10px] leading-relaxed border ${
              phase === 'voicemail_sent'
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            }`}>
              {phase === 'voicemail_sent'
                ? 'No answer — voicemail left with callback number (844-469-4283 x900).'
                : 'Call ended.'}
            </div>
          )}

          {/* ── Active call controls ─────────────────────────────────── */}
          {isLive && (
            <div className="flex gap-2">
              <button
                onClick={toggleMute}
                className={`flex-1 py-2.5 rounded-lg border text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                  muted
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'border-white/[0.10] text-slate-400 hover:bg-white/[0.05]'
                }`}
              >
                {muted ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                    </svg>
                    Muted
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                    </svg>
                    Mute
                  </>
                )}
              </button>
              <button
                onClick={hangUp}
                className="flex-1 py-2.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-[11px] font-bold text-white transition-all flex items-center justify-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.75 3.75L18 6m0 0l2.25 2.25M18 6l2.25-2.25M18 6l-2.25 2.25M3 3l1.5 1.5m0 0L6 6m-1.5-1.5L6 3M3 3l3 3M21 21l-1.5-1.5m0 0L18 18m1.5 1.5L18 21m1.5-1.5L18 18M3 21l6-6m0 0l3-3m-3 3l-2.25 2.25M12 12l3 3" />
                </svg>
                Hang Up
              </button>
            </div>
          )}

          {/* ── Ringing / Connecting state ───────────────────────────── */}
          {(phase === 'connecting' || phase === 'ringing') && (
            <div className="flex gap-2">
              <div className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25">
                <span className="flex gap-1">
                  {[0, 150, 300].map(d => (
                    <span key={d}
                      className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce"
                      style={{ animationDelay: `${d}ms` }} />
                  ))}
                </span>
                <span className="text-[11px] font-semibold text-amber-400">
                  {phase === 'ringing' ? 'Ringing…' : 'Connecting…'}
                </span>
              </div>
              <button
                onClick={hangUp}
                className="px-4 py-2.5 rounded-lg bg-red-600/70 hover:bg-red-600 text-[11px] font-bold text-white transition-all"
              >
                Cancel
              </button>
            </div>
          )}

          {/* ── Call button (idle / ready) ───────────────────────────── */}
          {(phase === 'ready' || phase === 'loading') && (
            <button
              onClick={dial}
              disabled={!canDial}
              className="w-full py-3 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-[12px] font-bold text-white transition-all flex items-center justify-center gap-2"
            >
              {phase === 'loading' ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Initialising…
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

          {/* ── Post-call actions ────────────────────────────────────── */}
          {(isDone || phase === 'error') && (
            <div className="flex gap-2">
              <button
                onClick={reset}
                className="flex-1 py-2.5 rounded-lg border border-white/[0.10] text-[11px] font-bold text-slate-300 hover:bg-white/[0.05] transition-all"
              >
                Call Again
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-[11px] font-bold text-white transition-all"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
