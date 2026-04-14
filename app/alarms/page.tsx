"use client";

import React, { useState, useEffect } from "react";

// ============================================================================
// 🏢 MARBELLA REGISTERED HARDWARE (Hardcoded for Stability)
// ============================================================================
const MARBELLA_CAMERAS = [
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
// SMART VIDEO PLAYER (The "Simplicity" Version)
// ============================================================================
const SmartVideoPlayer = ({ camId, token, type = 'main', offsetSeconds = 0, className, controls = false }: any) => {
    const [streamUrl, setStreamUrl] = useState<string>('');

    useEffect(() => {
        if (!camId || !token) return;

        // 1. Cluster c031 (Verified from your logs)
        const cluster = "media.c031.eagleeyenetworks.com";
        
        // 2. STABLE V3 URL: We append &A={token} which EEN requires for HLS segments
        let hlsUrl = `https://${cluster}/media/streams/${type}/hls/getPlaylist.m3u8?esn=${camId}&A=${token}`;
        
        // 3. Time Travel (DVR) logic
        if (offsetSeconds > 0) {
            const d = new Date(Date.now() - offsetSeconds * 1000);
            const p = (n: number) => String(n).padStart(2, '0');
            const ts = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}.000`;
            hlsUrl += `&startTime=${ts}`;
        }

        // 4. Wrap in your working Vercel Proxy to bypass CORS
        setStreamUrl(`/api/een/proxy?url=${encodeURIComponent(hlsUrl)}&token=${encodeURIComponent(token)}`);
    }, [camId, token, offsetSeconds, type]);

    if (!streamUrl) return <div className="flex items-center justify-center bg-black h-full w-full border border-white/5 rounded-2xl text-[8px] text-slate-500 font-mono uppercase">Negotiating...</div>;

    return (
        <video 
            key={streamUrl}
            src={streamUrl} 
            autoPlay muted playsInline 
            controls={controls}
            className={`w-full h-full object-contain bg-black rounded-xl ${className}`} 
            onError={(e) => console.error("EEN Stream Error:", e)}
        />
    );
};

export default function AlarmsPage() {
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [activeCam, setActiveCam] = useState<any>(MARBELLA_CAMERAS[0]);
  const [view, setView] = useState<'grid' | 'live' | 'incident' | 'map'>('grid');
  const [dvrOffset, setDvrOffset] = useState(0);
  const [isPatrol, setIsPatrol] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(`een_token_${SITE_NAME}`);
    if (token) setActiveToken(token);
  }, []);

  // VIRTUAL PATROL
  useEffect(() => {
    let interval: any;
    if (isPatrol) {
      setView('live');
      interval = setInterval(() => {
        setActiveCam((prev: any) => {
          const idx = MARBELLA_CAMERAS.findIndex(c => c.id === prev.id);
          return MARBELLA_CAMERAS[(idx + 1) % MARBELLA_CAMERAS.length];
        });
      }, 10000);
    }
    return () => clearInterval(interval);
  }, [isPatrol]);

  return (
    <div className="w-full h-full flex flex-col p-4 bg-[#030508] text-white overflow-hidden font-sans">
      
      {/* TOP HEADER */}
      <div className="flex justify-between items-center mb-4 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
        <div>
          <h1 className="text-xl font-black tracking-tighter">SOC COMMAND DECK</h1>
          <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">{SITE_NAME}</p>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsPatrol(!isPatrol)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all border ${isPatrol ? 'bg-amber-500 border-amber-400 text-black animate-pulse' : 'bg-white/5 border-white/10 text-slate-400'}`}
          >
            {isPatrol ? 'PATROL ACTIVE' : 'START PATROL'}
          </button>
          
          <div className="flex bg-black/40 border border-white/10 rounded-xl p-1">
            {['grid', 'live', 'incident', 'map'].map(v => (
              <button 
                key={v}
                onClick={() => { setView(v as any); setDvrOffset(0); setIsPatrol(false); }}
                className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all ${view === v ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
              >
                {v.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        
        {/* LEFT: ALARM QUEUE (Using our Real IDs) */}
        <div className="w-72 bg-white/5 border border-white/10 rounded-[2rem] p-4 flex flex-col">
          <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest text-center">Alert Feed</h3>
          <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1">
            {MARBELLA_CAMERAS.slice(0, 4).map((cam, i) => (
              <div 
                key={cam.id} 
                onClick={() => { setActiveCam(cam); setView('incident'); setDvrOffset(15); }}
                className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl cursor-pointer hover:bg-red-500/10 transition-all group"
              >
                <div className="flex justify-between mb-1 text-[9px] font-black uppercase">
                  <span className="text-red-500">Motion</span>
                  <span className="text-slate-600">{i+1}m ago</span>
                </div>
                <span className="text-sm font-bold group-hover:text-red-400">{cam.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER: VIDEO VIEWPORT */}
        <div className="flex-1 bg-black border border-white/10 rounded-[2.5rem] relative overflow-hidden shadow-2xl flex flex-col">
          
          {view === 'grid' && (
            <div className="absolute inset-0 p-4 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto custom-scrollbar">
              {MARBELLA_CAMERAS.map(cam => (
                <div key={cam.id} onDoubleClick={() => { setActiveCam(cam); setView('live'); }} className="aspect-video bg-slate-900 border border-white/10 rounded-2xl overflow-hidden relative cursor-pointer hover:border-blue-500 transition-all">
                  <SmartVideoPlayer camId={cam.id} token={activeToken} type="preview" />
                  <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[8px] font-bold">{cam.name}</div>
                </div>
              ))}
            </div>
          )}

          {view === 'live' && activeCam && (
            <div className="absolute inset-0 flex flex-col">
              <div className="flex-1 relative bg-black">
                <SmartVideoPlayer camId={activeCam.id} token={activeToken} offsetSeconds={dvrOffset} controls={true} />
                <div className="absolute top-6 left-6 flex gap-2">
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-black border ${dvrOffset === 0 ? 'bg-red-600/20 text-red-500 border-red-500/50' : 'bg-amber-600/20 text-amber-500 border-amber-500/50'}`}>
                    {dvrOffset === 0 ? '● LIVE' : `RECORDING (-${dvrOffset}s)`}
                  </span>
                  <span className="bg-black/60 border border-white/10 px-4 py-1.5 rounded-full text-[10px] font-bold">{activeCam.name.toUpperCase()}</span>
                </div>
              </div>
              <div className="h-20 bg-white/5 border-t border-white/10 flex items-center px-8 gap-4 justify-center">
                {[0, 30, 60, 300].map(s => (
                  <button key={s} onClick={() => setDvrOffset(s)} className={`px-6 py-2 rounded-xl text-[10px] font-black ${dvrOffset === s ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}>
                    {s === 0 ? 'LIVE' : `-${s}s`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {view === 'incident' && activeCam && (
            <div className="absolute inset-0 flex">
              <div className="flex-1 border-r border-white/10 relative">
                <SmartVideoPlayer camId={activeCam.id} token={activeToken} offsetSeconds={15} />
                <span className="absolute bottom-6 left-6 bg-amber-600 px-3 py-1 rounded-lg text-[9px] font-black">INCIDENT REPLAY</span>
              </div>
              <div className="flex-1 relative">
                <SmartVideoPlayer camId={activeCam.id} token={activeToken} offsetSeconds={0} />
                <span className="absolute bottom-6 left-6 bg-red-600 px-3 py-1 rounded-lg text-[9px] font-black">LIVE STATUS</span>
              </div>
            </div>
          )}

          {view === 'map' && <div className="absolute inset-0 flex items-center justify-center text-slate-700 text-xs font-black tracking-widest uppercase">Floorplan Module Pending</div>}
        </div>

        {/* RIGHT: BRIVO & SOPs */}
        <div className="w-72 shrink-0 flex flex-col gap-4">
          <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 shadow-xl text-center">
            <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Access Control</h3>
            <button className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl text-xs font-black shadow-lg shadow-blue-900/40 transition-all mb-3">🔓 UNLOCK GATE</button>
            <button className="w-full bg-white/5 hover:bg-white/10 py-4 rounded-2xl text-[10px] font-black border border-white/10 transition-all">🏢 OFFICE ACCESS</button>
          </div>
          
          <div className="bg-gradient-to-br from-indigo-900/20 to-transparent border border-indigo-500/20 rounded-[2rem] p-6 flex-1 shadow-2xl">
            <h3 className="text-[10px] font-black text-indigo-400 uppercase mb-6 tracking-widest text-center">Dispatch Checklist</h3>
            <div className="space-y-4 opacity-40">
              {["Verify Subject", "Identify Vehicle", "Log Incident"].map(t => (
                <div key={t} className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-white/20 rounded-lg"></div>
                  <span className="text-xs font-bold text-slate-300">{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
