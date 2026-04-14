"use client";

import React, { useState, useEffect, useRef } from "react";

// ============================================================================
// 🏢 REGISTERED SITE DATA
// ============================================================================
const REGISTERED_CAMERAS = [
  { id: "100ba88a", name: "Dumpster" },
  { id: "10059648", name: "Gate" },
  { id: "100ebfc5", name: "Gate Entrance" },
  { id: "1009a37e", name: "gym" },
  { id: "1007d097", name: "Leasing Desk" },
  { id: "100c2e51", name: "Leasing Lobby" },
  { id: "1006bf65", name: "Mail Left" },
  { id: "100601bd", name: "Mail Right" },
  { id: "100fa50d", name: "Maintenance Camera" },
  { id: "100b1c89", name: "Manager Office" },
  { id: "100fd212", name: "Pool Camera" }
];

const SITE_NAME = "Pegasus Properties - Marbella Place";

// ============================================================================
// RESILIENT VIDEO PLAYER
// ============================================================================
const SmartVideoPlayer = ({ camId, token, type = 'main', offsetSeconds = 0, className, controls = false }: any) => {
    const [streamUrl, setStreamUrl] = useState<string>('');

    useEffect(() => {
        if (!camId || !token) return;

        const cluster = "https://media.c031.eagleeyenetworks.com";
        let hlsUrl = `${cluster}/media/streams/${type}/hls/getPlaylist.m3u8?esn=${camId}`;
        
        if (offsetSeconds > 0) {
            const d = new Date(Date.now() - offsetSeconds * 1000);
            const pad = (n: number) => String(n).padStart(2, '0');
            const ts = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}.000`;
            hlsUrl += `&startTime=${ts}`;
        }

        setStreamUrl(`/api/een/proxy?url=${encodeURIComponent(hlsUrl)}&token=${encodeURIComponent(token)}`);
    }, [camId, token, offsetSeconds, type]);

    if (!streamUrl) return <div className="flex items-center justify-center bg-black h-full w-full animate-pulse text-[8px] text-emerald-500 font-mono uppercase">Negotiating...</div>;

    return (
        <video 
            key={streamUrl}
            src={streamUrl} 
            autoPlay muted playsInline 
            controls={controls}
            className={`w-full h-full object-contain bg-black ${className}`} 
        />
    );
};

export default function AlarmsPage() {
  // --- STATE ---
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [activeCam, setActiveCam] = useState<any>(REGISTERED_CAMERAS[0]);
  const [view, setView] = useState<'grid' | 'live' | 'incident' | 'map'>('grid');
  const [dvrOffset, setDvrOffset] = useState(0);
  const [isPatrolMode, setIsPatrolMode] = useState(false);
  const patrolIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- INITIAL LOAD ---
  useEffect(() => {
    const token = localStorage.getItem(`een_token_${SITE_NAME}`);
    if (token) setActiveToken(token);
  }, []);

  // --- VIRTUAL PATROL LOGIC ---
  useEffect(() => {
    if (isPatrolMode) {
      setView('live');
      let currentIndex = REGISTERED_CAMERAS.findIndex(c => c.id === activeCam.id);
      patrolIntervalRef.current = setInterval(() => {
        currentIndex = (currentIndex + 1) % REGISTERED_CAMERAS.length;
        setActiveCam(REGISTERED_CAMERAS[currentIndex]);
      }, 10000); // 10s rotation
    } else {
      if (patrolIntervalRef.current) clearInterval(patrolIntervalRef.current);
    }
    return () => { if (patrolIntervalRef.current) clearInterval(patrolIntervalRef.current); };
  }, [isPatrolMode, activeCam.id]);

  // --- HANDLERS ---
  const handleUnlockDoor = (name: string) => {
    alert(`Brivo API: Unlocking ${name}`);
  };

  const handleFlagIncident = () => {
    alert(`Supabase: Incident logged for ${activeCam.name} at T-${dvrOffset}s`);
  };

  return (
    <div className="w-full h-full flex flex-col p-4 bg-[#020408] text-white overflow-hidden font-sans">
      
      {/* HEADER COMMAND DECK */}
      <div className="flex justify-between items-center mb-4 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
        <div className="flex items-center gap-6">
            <div>
              <h1 className="text-xl font-black tracking-tighter">SOC COMMAND DECK</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{SITE_NAME}</p>
            </div>
            
            {/* START PATROL BUTTON */}
            <button 
              onClick={() => setIsPatrolMode(!isPatrolMode)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all border ${isPatrolMode ? 'bg-amber-500/20 border-amber-500 text-amber-500 animate-pulse' : 'bg-white/5 border-white/10 text-slate-400'}`}
            >
              {isPatrolMode ? '● PATROL ACTIVE' : 'START PATROL'}
            </button>
        </div>

        {/* VIEW SELECTOR */}
        <div className="flex bg-black/40 border border-white/10 rounded-xl p-1 shadow-inner">
            {['grid', 'live', 'incident', 'map'].map(v => (
                <button 
                    key={v}
                    onClick={() => { setView(v as any); setDvrOffset(0); setIsPatrolMode(false); }}
                    className={`px-5 py-2 rounded-lg text-[10px] font-black tracking-widest transition-all ${view === v ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-white'}`}
                >
                    {v.toUpperCase()}
                </button>
            ))}
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        
        {/* LEFT PANEL: ALARM QUEUE */}
        <div className="w-80 bg-white/5 border border-white/10 rounded-[2rem] p-4 flex flex-col">
            <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-[0.2em] text-center border-b border-white/5 pb-2">Active Events</h3>
            <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1 pr-1">
                {REGISTERED_CAMERAS.slice(0, 5).map((cam, i) => (
                    <div 
                        key={cam.id} 
                        onClick={() => { setActiveCam(cam); setView('incident'); setDvrOffset(15); setIsPatrolMode(false); }}
                        className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl cursor-pointer hover:bg-red-500/10 transition-all group"
                    >
                        <div className="flex justify-between mb-1 text-[9px] font-black uppercase">
                            <span className="text-red-500">Alert Trigger</span>
                            <span className="text-slate-600">NOW</span>
                        </div>
                        <span className="text-sm font-bold group-hover:text-red-400 truncate block">{cam.name}</span>
                    </div>
                ))}
            </div>
        </div>

        {/* CENTER: MAIN VIDEO CANVAS */}
        <div className="flex-1 bg-black border border-white/10 rounded-[2.5rem] relative overflow-hidden shadow-2xl flex flex-col">
            
            {/* VIEW 1: GRID */}
            {view === 'grid' && (
                <div className="absolute inset-0 p-4 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto custom-scrollbar">
                    {REGISTERED_CAMERAS.map(cam => (
                        <div 
                            key={cam.id} 
                            onDoubleClick={() => { setActiveCam(cam); setView('live'); }}
                            className="aspect-video bg-slate-950 border border-white/10 rounded-2xl overflow-hidden relative cursor-pointer group hover:border-blue-500/50 transition-all shadow-lg"
                        >
                            <SmartVideoPlayer camId={cam.id} token={activeToken} streamType="preview" />
                            <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-lg text-[9px] font-bold border border-white/5 pointer-events-none group-hover:text-blue-400">
                                {cam.name}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* VIEW 2: SINGLE LIVE / DVR */}
            {view === 'live' && activeCam && (
                <div className="absolute inset-0 flex flex-col">
                    <div className="flex-1 relative bg-black">
                        <SmartVideoPlayer camId={activeCam.id} token={activeToken} offsetSeconds={dvrOffset} controls={true} />
                        <div className="absolute top-6 left-6 flex gap-2">
                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest backdrop-blur-xl border ${dvrOffset === 0 ? 'bg-red-500/20 text-red-400 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-amber-500/20 text-amber-400 border-amber-500/50 animate-pulse'}`}>
                                {dvrOffset === 0 ? '● LIVE STREAM' : `DVR PLAYBACK (-${dvrOffset}s)`}
                            </span>
                            <span className="bg-black/60 backdrop-blur-md border border-white/10 px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase">
                                {activeCam.name}
                            </span>
                        </div>
                    </div>
                    <div className="h-20 bg-white/5 border-t border-white/10 flex items-center px-8 gap-4 justify-center backdrop-blur-md">
                        <button onClick={() => setDvrOffset(0)} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${dvrOffset === 0 ? 'bg-red-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}>LIVE FEED</button>
                        <button onClick={() => setDvrOffset(30)} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${dvrOffset === 30 ? 'bg-amber-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}>-30s</button>
                        <button onClick={() => setDvrOffset(60)} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${dvrOffset === 60 ? 'bg-amber-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}>-1m</button>
                        <button onClick={() => setDvrOffset(300)} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${dvrOffset === 300 ? 'bg-amber-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}>-5m</button>
                    </div>
                </div>
            )}

            {/* VIEW 3: INCIDENT (CLIP + LIVE) */}
            {view === 'incident' && activeCam && (
                <div className="absolute inset-0 flex">
                    <div className="flex-1 border-r border-white/10 relative">
                        <SmartVideoPlayer camId={activeCam.id} token={activeToken} offsetSeconds={15} />
                        <span className="absolute bottom-6 left-6 bg-amber-600 px-3 py-1 rounded-lg text-[10px] font-black shadow-xl">INCIDENT PLAYBACK</span>
                    </div>
                    <div className="flex-1 relative">
                        <SmartVideoPlayer camId={activeCam.id} token={activeToken} offsetSeconds={0} />
                        <span className="absolute bottom-6 left-6 bg-red-600 px-3 py-1 rounded-lg text-[10px] font-black shadow-xl">LIVE STATUS</span>
                    </div>
                </div>
            )}

            {/* VIEW 4: SITE MAP */}
            {view === 'map' && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
                    <div className="text-center opacity-30">
                        <div className="text-4xl mb-4">🗺️</div>
                        <h2 className="text-sm font-black tracking-[0.5em] uppercase">Interactive Floorplan Pending</h2>
                    </div>
                </div>
            )}

        </div>

        {/* RIGHT PANEL: BRIVO & SOPS */}
        <div className="w-80 shrink-0 flex flex-col gap-4">
            <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 shadow-xl">
                <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest text-center border-b border-white/5 pb-2">Access Control</h3>
                <button onClick={() => handleUnlockDoor("Main Gate")} className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl text-xs font-black shadow-lg shadow-blue-900/40 transition-all active:scale-95 mb-3">
                    🔓 PULSE MAIN GATE
                </button>
                <button onClick={() => handleUnlockDoor("Office")} className="w-full bg-white/5 hover:bg-white/10 py-4 rounded-2xl text-[10px] font-black border border-white/10 transition-all active:scale-95">
                    🏢 UNLOCK OFFICE
                </button>
            </div>
            
            <div className="bg-gradient-to-br from-indigo-600/10 to-transparent border border-indigo-500/20 rounded-[2rem] p-6 flex-1 shadow-2xl flex flex-col">
                <h3 className="text-[10px] font-black text-indigo-400 uppercase mb-6 tracking-widest text-center">Dispatch Checklist</h3>
                <div className="space-y-4 opacity-40 flex-1">
                    {["Identify Subject", "Verify Credential", "Log Action"].map((text) => (
                        <div key={text} className="flex items-center gap-4">
                            <div className="w-5 h-5 border-2 border-white/20 rounded-lg bg-black/40"></div>
                            <span className="text-xs font-bold text-slate-300">{text}</span>
                        </div>
                    ))}
                </div>
                <button onClick={handleFlagIncident} className="w-full bg-red-600 hover:bg-red-500 text-white py-4 rounded-2xl text-[10px] font-black transition-all">
                    REPORT INCIDENT
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}
