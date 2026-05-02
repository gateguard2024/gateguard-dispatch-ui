'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

type StepType = 'question' | 'action' | 'resolved' | 'escalate'

interface Step {
  type:       StepType
  text:       string
  detail:     string | null
  manual_ref: { url: string | null; page: number | null; section: string | null } | null
}

interface HistoryItem {
  question: string
  answer:   string
  detail:   string | null
}

function TroubleshootWizard() {
  const params     = useSearchParams()
  const equipId    = params.get('equipment_id') ?? undefined
  const equipModel = params.get('model') ?? ''

  const [symptom,    setSymptom]    = useState('')
  const [started,    setStarted]    = useState(false)
  const [history,    setHistory]    = useState<HistoryItem[]>([])
  const [current,    setCurrent]    = useState<Step | null>(null)
  const [sessionId,  setSessionId]  = useState<string | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [freeAnswer, setFreeAnswer] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, current])

  async function fetchNextStep(newHistory: HistoryItem[]) {
    setLoading(true)
    const res = await fetch('/api/dealer/troubleshoot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symptom,
        equipment_id: equipId,
        history:      newHistory,
        session_id:   sessionId,
      }),
    })
    const data = await res.json()
    setLoading(false)

    if (data.error) {
      alert(`Error: ${data.error}`)
      return
    }

    if (!sessionId && data.session_id) setSessionId(data.session_id)
    setCurrent(data as Step)
  }

  async function handleStart() {
    if (!symptom.trim()) return
    setStarted(true)
    await fetchNextStep([])
  }

  async function handleAnswer(answer: string) {
    if (!current) return
    const newHistory: HistoryItem[] = [
      ...history,
      { question: current.text, answer, detail: current.detail },
    ]
    setHistory(newHistory)
    setCurrent(null)

    if (current.type === 'resolved' || current.type === 'escalate') return
    await fetchNextStep(newHistory)
  }

  function handleReset() {
    setSymptom('')
    setStarted(false)
    setHistory([])
    setCurrent(null)
    setSessionId(null)
    setFreeAnswer('')
  }

  const stepColor: Record<StepType, string> = {
    question: '#3B82F6',
    action:   '#F59E0B',
    resolved: '#10B981',
    escalate: '#EF4444',
  }

  const stepIcon: Record<StepType, string> = {
    question: '?',
    action:   '→',
    resolved: '✓',
    escalate: '!',
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">AI Troubleshooter</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {equipModel ? `Device: ${equipModel}` : 'All equipment'} · Grounded in install manuals
            </p>
          </div>
          {started && (
            <button
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-400 transition-colors"
            >
              ↺ New Session
            </button>
          )}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">

        {/* ── Symptom entry ─────────────────────────────────────────────── */}
        {!started && (
          <div className="max-w-lg mx-auto mt-8">
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-3">Describe the problem</p>
            <textarea
              value={symptom}
              onChange={e => setSymptom(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleStart() } }}
              placeholder={`e.g. "Gate won't open after power outage" or "Callbox shows no video"`}
              rows={3}
              className="w-full bg-[#13151a] border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
            />
            <button
              onClick={handleStart}
              disabled={!symptom.trim()}
              className="mt-3 w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white text-sm font-semibold transition-colors"
            >
              Start Diagnostic
            </button>
            {equipModel && (
              <p className="text-[10px] text-slate-600 text-center mt-3">
                AI will search the {equipModel} manual for relevant sections
              </p>
            )}
          </div>
        )}

        {/* ── Symptom summary ───────────────────────────────────────────── */}
        {started && (
          <div className="rounded-xl bg-white/5 border border-white/8 px-4 py-3">
            <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-1">Reported Issue</p>
            <p className="text-sm text-slate-300">"{symptom}"</p>
          </div>
        )}

        {/* ── History ───────────────────────────────────────────────────── */}
        {history.map((h, i) => (
          <div key={i} className="space-y-1.5">
            <div className="rounded-xl bg-[#13151a] border border-white/5 px-4 py-3">
              <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-1">Step {i + 1}</p>
              <p className="text-sm text-slate-300">{h.question}</p>
              {h.detail && <p className="text-xs text-slate-600 mt-1">{h.detail}</p>}
            </div>
            <div className="flex justify-end">
              <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                h.answer === 'yes' || h.answer === 'Yes'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : h.answer === 'no' || h.answer === 'No'
                  ? 'bg-red-500/10 text-red-400'
                  : 'bg-indigo-500/10 text-indigo-400'
              }`}>
                {h.answer}
              </span>
            </div>
          </div>
        ))}

        {/* ── Loading ───────────────────────────────────────────────────── */}
        {loading && (
          <div className="rounded-xl bg-[#13151a] border border-white/5 px-4 py-4 flex items-center gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin flex-shrink-0" />
            <p className="text-xs text-slate-500">Searching manuals and generating next step…</p>
          </div>
        )}

        {/* ── Current step ──────────────────────────────────────────────── */}
        {current && !loading && (
          <div
            className="rounded-xl border px-4 py-4"
            style={{
              background:   `${stepColor[current.type]}08`,
              borderColor:  `${stepColor[current.type]}30`,
            }}
          >
            {/* Step type badge */}
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: `${stepColor[current.type]}20`, color: stepColor[current.type] }}
              >
                {stepIcon[current.type]}
              </div>
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: stepColor[current.type] }}
              >
                {current.type === 'question' ? 'Check this' :
                 current.type === 'action'   ? 'Do this' :
                 current.type === 'resolved' ? 'Issue Resolved' : 'Escalate'}
              </span>
            </div>

            <p className="text-sm font-semibold text-white mb-2">{current.text}</p>

            {current.detail && (
              <p className="text-xs text-slate-400 mb-3 leading-relaxed">{current.detail}</p>
            )}

            {/* Manual reference */}
            {current.manual_ref?.url && (
              <a
                href={`${current.manual_ref.url}${current.manual_ref.page ? `#page=${current.manual_ref.page}` : ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-indigo-400 transition-colors mb-3"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Manual reference{current.manual_ref.page ? ` · p.${current.manual_ref.page}` : ''}{current.manual_ref.section ? ` · ${current.manual_ref.section}` : ''}
              </a>
            )}

            {/* Answer buttons */}
            {current.type === 'question' && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleAnswer('yes')}
                  className="flex-1 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-semibold transition-colors border border-emerald-500/20"
                >
                  Yes
                </button>
                <button
                  onClick={() => handleAnswer('no')}
                  className="flex-1 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-semibold transition-colors border border-red-500/20"
                >
                  No
                </button>
              </div>
            )}

            {current.type === 'action' && (
              <div className="mt-3 space-y-2">
                <button
                  onClick={() => handleAnswer('Done')}
                  className="w-full py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-sm font-semibold transition-colors border border-amber-500/20"
                >
                  Done — Continue
                </button>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={freeAnswer}
                    onChange={e => setFreeAnswer(e.target.value)}
                    placeholder="Or describe what you see…"
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    onKeyDown={e => { if (e.key === 'Enter' && freeAnswer.trim()) { handleAnswer(freeAnswer); setFreeAnswer('') } }}
                  />
                  <button
                    onClick={() => { if (freeAnswer.trim()) { handleAnswer(freeAnswer); setFreeAnswer('') } }}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 text-xs transition-colors hover:bg-indigo-600/30"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}

            {(current.type === 'resolved' || current.type === 'escalate') && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleReset}
                  className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 text-sm transition-colors"
                >
                  New Session
                </button>
                {current.type === 'escalate' && (
                  <button
                    onClick={() => handleAnswer('Continue anyway')}
                    className="flex-1 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm transition-colors border border-red-500/20"
                  >
                    Keep Diagnosing
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}

export default function TroubleshootPage() {
  return (
    <Suspense fallback={
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
      </div>
    }>
      <TroubleshootWizard />
    </Suspense>
  )
}
