"use client";

import React, { useState, useEffect, useRef } from "react";

// ============================================================================
// 🏢 SITE CONFIGURATION (Matches your Setup page filtering)
// ============================================================================
const MARBELLA_SITE = {
  name: "Pegasus Properties - Marbella Place",
  bridgeEsn: "10071c5d",
  keyword: "Marbella Place"
};

// ============================================================================
// SMART VIDEO PLAYER (Proxies through /api/een/proxy)
// ============================================================================
const SmartVideoPlayer = ({ camId, token, streamType = 'main', offsetSeconds = 0, className, controls = false }: any) => {
    const [streamUrl, setStreamUrl] = useState<string>('');

    useEffect(() => {
        if (!camId || !token) return;

        // 1. Construct EEN V3 Stream URL
        const cluster = "https://media.c031.eagleeyenetworks.com";
        let hlsUrl = `${cluster}/media/streams/${streamType}/hls/getPlaylist.m3u8?esn=${camId}`;
        
        // 2. Add DVR Time Travel if needed
        if (offsetSeconds > 0) {
            const d = new Date(Date.now() - offsetSeconds * 1000);
            const pad = (n: number) => String(n).padStart(w, '0');
            const ts = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}${String(d.getUTCSeconds()).padStart(2, '0')}.000`;
            hlsUrl += `&startTime=${ts}`;
        }

        // 3. Wrap in your working Vercel Proxy
        setStreamUrl(`/api/een/proxy?url=${encodeURIComponent(hlsUrl)}&token=${encodeURIComponent(token)}`);
    }, [camId, token, offsetSeconds, streamType]);

    if (!streamUrl) return <div className="flex items-center justify-center bg-black/40 h-full animate-pulse text-[10px] font-mono">HANDSHAKE...</div>;

    return (
        <video 
            key={streamUrl} // Force reload on time change
            src={streamUrl} 
            autoPlay muted playsInline 
            controls={controls}
            className={`w-full h-full object-contain bg-black ${className}`} 
        />
    );
};

export default function AlarmsPage() {
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [cameras, setCameras] = useState<any[]>([]);
  const [activeCam, setActiveCam] = useState<any>(null);
  const [view, setView] = useState<'grid' | 'live' | 'incident'>('grid');
  const [dvrOffset, setDvrOffset] = useState(0);

  // 1. Initialize Token from Storage
  useEffect(() => {
    const token = localStorage.getItem(`een_token_${MARBELLA_SITE.name}`);
    if (token) setActiveToken(token);
  }, []);

  // 2. Fetch & Hybrid Filter (Ensures you get exactly the 11 Marbella cams)
  useEffect(() => {
    if (!activeToken) return;

    const fetchCams = async () => {
      const res = await fetch('/api/een/cameras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: activeToken, siteName: MARBELLA_SITE.name })
      });

      if (res.ok) {
        const data = await res.json();
        const all = data.results || [];
        
        // APPLY HYBRID FILTER
        const filtered = all.filter((c: any) => {
          const bridge = c.bridgeId || "";
          const name = (c.name || "").toLowerCase();
          return bridge === MARBELLA_SITE.bridgeEsn || name.includes(MARBELLA_SITE.keyword.toLowerCase());
        });

        const formatted = filtered.map((c: any) => ({ id: c.camera_id || c.esn, name: c.name }));
        setCameras(formatted);
        if (formatted.length > 0) setActiveCam(formatted[0]);
      }
    };
    fetchCams();
  }, [activeToken]);

  return (
    <div className="w-full h-full flex flex-col p-4 bg-[#020408] text-white overflow-hidden">
      
      {/* HEADER BAR */}
      <div className="flex justify-between items-center mb-4 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
        <div>
            <h1 className="text-xl font-black tracking-tighter">SOC COMMAND DECK</h1>
            <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">{MARBELLA_SITE.name}</p>
        </div>

        <div className="flex bg-black/40 border border-white/10 rounded-xl p-1">
            {['grid', 'live', 'incident'].map(v => (
                <button 
                    key={v}
                    onClick={() => { setView(v as any); setDvrOffset(0); }}
                    className={`px-6 py-2 rounded-lg text-[10px] font-black tracking-widest transition-all ${view === v ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                >
                    {v.toUpperCase()}
                </button>
            ))}
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        
        {/* LEFT: INCIDENT QUEUE */}
        <div className="w-80 bg-white/5 border border-white/10 rounded-3xl p-4 flex flex-col">
            <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-[0.2em] text-center">Live Events</h3>
            <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1">
                {cameras.slice(0, 5).map((cam) => (
                    <div 
                        key={cam.id} 
                        onClick={() => { setActiveCam(cam); setView('incident'); setDvrOffset(15); }}
                        className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl cursor-pointer hover:bg-red-500/10 transition-all group"
                    >
                        <div className="flex justify-between mb-1">
                            <span className="text-[9px] font-black text-red-500 uppercase">Alert</span>
                            <span className="text-[9px] text-slate-600 font-mono">NOW</span>
                        </div>
                        <span className="text-sm font-bold group-hover:text-red-400">{cam.name}</span>
                    </div>
                ))}
            </div>
        </div>

        {/* CENTER: MAIN CANVAS */}
        <div className="flex-1 bg-black border border-white/10 rounded-[2.5rem] relative overflow-hidden shadow-2xl flex flex-col">
            
            {/* GRID VIEW */}
            {view === 'grid' && (
                <div className="absolute inset-0 p-4 grid grid-cols-3 gap-3 overflow-y-auto custom-scrollbar">
                    {cameras.map(cam => (
                        <div 
                            key={cam.id} 
                            onDoubleClick={() => { setActiveCam(cam); setView('live'); }}
                            className="aspect-video bg-slate-900 border border-white/10 rounded-2xl overflow-hidden relative cursor-pointer group hover:border-blue-500/50 transition-all"
                        >
                            <SmartVideoPlayer camId={cam.id} token={activeToken} streamType="preview" />
                            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-lg text-[9px] font-bold border border-white/5">
                                {cam.name}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* SINGLE CAM VIEW */}
            {view === 'live' && activeCam && (
                <div className="absolute inset-0 flex flex-col">
                    <div className="flex-1 relative">
                        <SmartVideoPlayer camId={activeCam.id} token={activeToken} streamType="main" offsetSeconds={dvrOffset} controls={true} />
                        <div className="absolute top-6 left-6 flex gap-2">
                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest backdrop-blur-xl border ${dvrOffset === 0 ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-amber-500/20 text-amber-400 border-amber-500/50 animate-pulse'}`}>
                                {dvrOffset === 0 ? '● LIVE FEED' : `DVR PLAYBACK (-${dvrOffset}s)`}
                            </span>
                        </div>
                    </div>
                    {/* DVR SCRUBBER */}
                    <div className="h-16 bg-white/5 border-t border-white/10 flex items-center px-8 gap-4 justify-center">
                        <button onClick={() => setDvrOffset(0)} className={`px-4 py-1 rounded text-[10px] font-bold ${dvrOffset === 0 ? 'bg-red-600 text-white' : 'text-slate-400'}`}>LIVE</button>
                        <button onClick={() => setDvrOffset(30)} className={`px-4 py-1 rounded text-[10px] font-bold ${dvrOffset === 30 ? 'bg-amber-600 text-white' : 'text-slate-400'}`}>-30s</button>
                        <button onClick={() => setDvrOffset(60)} className={`px-4 py-1 rounded text-[10px] font-bold ${dvrOffset === 60 ? 'bg-amber-600 text-white' : 'text-slate-400'}`}>-1m</button>
                        <button onClick={() => setDvrOffset(300)} className={`px-4 py-1 rounded text-[10px] font-bold ${dvrOffset === 300 ? 'bg-amber-600 text-white' : 'text-slate-400'}`}>-5m</button>
                    </div>
                </div>
            )}

            {/* INCIDENT VIEW (DUAL PANE) */}
            {view === 'incident' && activeCam && (
                <div className="absolute inset-0 flex">
                    <div className="flex-1 border-r border-white/10 relative">
                        <SmartVideoPlayer camId={activeCam.id} token={activeToken} streamType="main" offsetSeconds={dvrOffset || 15} />
                        <span className="absolute bottom-6 left-6 bg-amber-600 px-3 py-1 rounded-lg text-[10px] font-black">INCIDENT CLIP</span>
                    </div>
                    <div className="flex-1 relative">
                        <SmartVideoPlayer camId={activeCam.id} token={activeToken} streamType="main" offsetSeconds={0} />
                        <span className="absolute bottom-6 left-6 bg-red-600 px-3 py-1 rounded-lg text-[10px] font-black">LIVE STATUS</span>
                    </div>
                </div>
            )}

        </div>

        {/* RIGHT: CONTROLS */}
        <div className="w-80 shrink-0 space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-xl">
                <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Property Access</h3>
                <button className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl text-xs font-black shadow-lg shadow-indigo-900/40 transition-all active:scale-95 mb-3">
                    🔓 PULSE MAIN GATE
                </button>
                <button className="w-full bg-white/5 hover:bg-white/10 py-4 rounded-2xl text-xs font-black border border-white/10 transition-all active:scale-95">
                    🏢 UNLOCK AMENITY
                </button>
            </div>
            
            <div className="bg-gradient-to-br from-blue-600/20 to-transparent border border-blue-500/20 rounded-3xl p-6 flex-1 h-[200px]">
                <h3 className="text-[10px] font-black text-blue-400 uppercase mb-4 tracking-widest">SOP Status</h3>
                <div className="space-y-4 opacity-50">
                    <div className="flex items-center gap-3">
                        <div className="w-5 h-5 border border-white/20 rounded-lg bg-black/40"></div>
                        <span className="text-xs font-bold">Subject Identified</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-5 h-5 border border-white/20 rounded-lg bg-black/40"></div>
                        <span className="text-xs font-bold">Credential Logged</span>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
