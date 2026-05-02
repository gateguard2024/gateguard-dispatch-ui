'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const CATEGORIES = [
  { key: 'all',            label: 'All' },
  { key: 'gate_operator',  label: 'Gate Operators' },
  { key: 'callbox',        label: 'Callboxes' },
  { key: 'access_reader',  label: 'Access Readers' },
  { key: 'smart_lock',     label: 'Smart Locks' },
  { key: 'camera',         label: 'Cameras' },
  { key: 'network',        label: 'Network' },
  { key: 'intercom',       label: 'Intercoms' },
]

const CATEGORY_COLORS: Record<string, string> = {
  gate_operator: '#F59E0B',
  callbox:       '#3B82F6',
  access_reader: '#10B981',
  smart_lock:    '#C8A45A',
  camera:        '#8B5CF6',
  network:       '#06B6D4',
  intercom:      '#EC4899',
  other:         '#6B7280',
}

interface Equipment {
  id:             string
  category:       string
  brand:          string
  model:          string
  model_number:   string | null
  description:    string | null
  manual_url:     string | null
  spec_sheet_url: string | null
  install_time_hrs: number | null
  tags:           string[] | null
  _chunks?:       number
}

export default function EquipmentLibrary() {
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [filtered,  setFiltered]  = useState<Equipment[]>([])
  const [category,  setCategory]  = useState('all')
  const [search,    setSearch]    = useState('')
  const [loading,   setLoading]   = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [selected,  setSelected]  = useState<Equipment | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase
      .from('equipment')
      .select('*')
      .eq('active', true)
      .order('category')
      .order('brand')
      .then(({ data }) => {
        setEquipment(data ?? [])
        setFiltered(data ?? [])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    let list = equipment
    if (category !== 'all') list = list.filter(e => e.category === category)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(e =>
        e.brand.toLowerCase().includes(q) ||
        e.model.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.tags?.some(t => t.includes(q))
      )
    }
    setFiltered(list)
  }, [category, search, equipment])

  async function handleUpload(equip: Equipment) {
    const input = fileRef.current
    if (!input) return
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      setUploading(equip.id)
      const form = new FormData()
      form.append('equipment_id', equip.id)
      form.append('file', file)
      const res = await fetch('/api/dealer/manuals/process', { method: 'POST', body: form })
      const data = await res.json()
      if (data.success) {
        setEquipment(prev => prev.map(e =>
          e.id === equip.id ? { ...e, manual_url: data.manual_url } : e
        ))
        alert(`✅ Manual processed — ${data.chunksCreated} searchable chunks created from ${data.pagesProcessed} pages`)
      } else {
        alert(`Error: ${data.error}`)
      }
      setUploading(null)
      input.value = ''
    }
    input.click()
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <input ref={fileRef} type="file" accept=".pdf" className="hidden" />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4 border-b border-white/5 flex-shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Equipment Library</h1>
            <p className="text-xs text-slate-500 mt-0.5">{equipment.length} devices · upload PDFs to enable AI troubleshooting</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search brand, model, tag…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 w-56"
            />
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                category === c.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map(equip => {
            const color = CATEGORY_COLORS[equip.category] ?? '#6B7280'
            const hasManual = !!equip.manual_url
            return (
              <div
                key={equip.id}
                className="relative rounded-xl border bg-[#13151a] transition-all cursor-pointer group"
                style={{ borderColor: selected?.id === equip.id ? color : 'rgba(255,255,255,0.06)' }}
                onClick={() => setSelected(selected?.id === equip.id ? null : equip)}
              >
                {/* Category stripe */}
                <div className="h-1 rounded-t-xl" style={{ background: color }} />

                <div className="p-4">
                  {/* Brand + model */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-xs font-semibold tracking-widest uppercase" style={{ color }}>
                        {equip.brand}
                      </p>
                      <h3 className="text-sm font-bold text-white leading-tight mt-0.5">{equip.model}</h3>
                      {equip.model_number && (
                        <p className="text-[10px] text-slate-600 mt-0.5">#{equip.model_number}</p>
                      )}
                    </div>
                    {/* Manual status badge */}
                    <div className={`flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      hasManual
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-white/5 text-slate-600 border border-white/5'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${hasManual ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                      {hasManual ? 'AI Ready' : 'No Manual'}
                    </div>
                  </div>

                  {/* Description */}
                  {equip.description && (
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-3">
                      {equip.description}
                    </p>
                  )}

                  {/* Tags */}
                  {equip.tags && equip.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {equip.tags.slice(0, 4).map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-slate-500">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Install time */}
                  {equip.install_time_hrs && (
                    <p className="text-[10px] text-slate-600 mb-3">
                      ⏱ ~{equip.install_time_hrs}h install
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 mt-auto">
                    {hasManual ? (
                      <a
                        href={equip.manual_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-400 text-center transition-colors"
                      >
                        View Manual
                      </a>
                    ) : (
                      <button
                        onClick={e => { e.stopPropagation(); handleUpload(equip) }}
                        disabled={uploading === equip.id}
                        className="flex-1 py-1.5 rounded-lg text-xs text-center transition-colors disabled:opacity-50"
                        style={{ background: `${color}18`, color }}
                      >
                        {uploading === equip.id ? 'Processing…' : '↑ Upload Manual'}
                      </button>
                    )}
                    <a
                      href={`/dealer/troubleshoot?equipment_id=${equip.id}&model=${encodeURIComponent(equip.brand + ' ' + equip.model)}`}
                      onClick={e => e.stopPropagation()}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-xs text-indigo-400 transition-colors whitespace-nowrap"
                    >
                      Troubleshoot
                    </a>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center text-slate-600 text-sm py-16">
            No equipment matching your filters.
          </div>
        )}
      </div>
    </div>
  )
}
