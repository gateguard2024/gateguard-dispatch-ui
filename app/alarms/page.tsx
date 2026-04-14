"use client";

import React, { useState, useEffect, useRef } from "react";

// ============================================================================
// 🏢 MARBELLA REGISTERED HARDWARE
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
// STABLE HLS PLAYER (Direct Cluster / Zero Handshake)
// ============================================================================
const SmartVideoPlayer = ({ camId, token, type = 'main', offsetSeconds = 0, controls = false }: any) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<any>(null);

    useEffect(() => {
        if (!camId || !token || !videoRef.current) return;

        // 1. Build Direct Authorized URL (Bypasses Handshake logic to fix 'undefined' errors)
        const cluster = "media.c031.eagleeyenetworks.com";
        let hlsUrl = `https://${cluster}/media/streams/${type}/hls/getPlaylist.m3u8?esn=${camId}&A=${token}`;

        if (offsetSeconds > 0) {
            const d = new Date(Date.now() - offsetSeconds * 1000);
            const pad = (n: number) => String(n).padStart(2, '0');
            const ts = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}.000`;
            hlsUrl += `&startTime=${ts}`;
        }

        const video = videoRef.current;

        const startHls = () => {
            if (hlsRef.current) hlsRef.current.destroy();

            // Native Support (Safari/iOS)
            if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = hlsUrl;
            } 
            // Chrome/Edge/Windows via HLS.js (Injected via CDN)
            else if ((window as any).Hls && (window as any).Hls.isSupported()) {
                const hls = new (window as any).Hls({
                    enableWorker: true,
                    lowLatencyMode: true,
                });
                hls.loadSource(hlsUrl);
                hls.attachMedia(video);
                hlsRef.current = hls;
            }
        };

        // Load HLS.js script if not present in window
        if (!(window as any).Hls) {
            const script = document.createElement("script");
            script.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
            script.onload = startHls;
            document.head.appendChild(script);
        } else {
            startHls();
        }

        return () => { if (hlsRef.current) hlsRef.current.destroy(); };
    }, [camId, token, type, offsetSeconds]);

    return <video ref={videoRef} autoPlay muted playsInline controls={controls} className="w-full h-full object-cover bg-black" />;
};

// ============================================================================
// MAIN PAGE
// ============================================================================
export default function AlarmsPage() {
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [activeCam, setActiveCam] = useState<any>(MARBELLA_CAMERAS[1]); // Default to Gate
  const [view, setView] = useState<'grid' | 'live' | 'incident'>('grid');
  const [dvrOffset, setDvrOffset] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem(`een_token_${SITE_NAME}`);
    if (token) setActiveToken(token);
  }, []);

  return (
    <div className="w-full h-full flex flex-col p-4 bg-[#010204] text-white overflow-hidden font-sans">
      
      {/* COMMAND HEADER */}
      <div className="flex justify-between items-center mb-4 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md shadow-2xl">
        <div>
          <h1 className="text-xl font-black tracking-tighter">SOC COMMAND DECK</h1>
          <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-[0.2em]">{SITE_NAME}</p>
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
        
        {/* LEFT NODE LIST */}
        <div className="w-72 bg-white/5 border border-white/10 rounded-[2rem] p-4 flex flex-col shadow-2xl">
          <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest text-center border-b border-white/5 pb-2">Active Nodes</h3>
          <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1 pr-1">
            {MARBELLA_CAMERAS.map((cam) => (
              <div 
                key={cam.id} 
                onClick={() => { setActiveCam(cam); setView('live'); }}
                className={`p-4 rounded-2xl cursor-pointer transition-all border ${activeCam?.id === cam.id ? 'bg-blue-600/20 border-blue-500/50' : 'bg-white/5 border-transparent hover:bg-white/10'}`}
              >
                <span className="text-sm font-bold block truncate">{cam.name}</span>
                <span className="text-[8px] text-slate-600 font-mono">ESN: {cam.id}</span>
              </div>
            ))}
          </div>
        </div>

        {/* MAIN VIDEO CENTER */}
        <div className="flex-1 bg-black border border-white/10 rounded-[2.5rem] relative overflow-hidden shadow-inner flex flex-col">
          
          {/* GRID VIEW */}
          {view === 'grid' && (
            <div className="absolute inset-0 p-4 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto custom-scrollbar">
              {MARBELLA_CAMERAS.map(cam => (
                <div 
                    key={cam.id} 
                    onDoubleClick={() => { setActiveCam(cam); setView('live'); }}
                    className="aspect-video bg-slate-950 border border-white/10 rounded-2xl overflow-hidden relative cursor-pointer hover:border-blue-500 transition-all shadow-lg group"
                >
                  <SmartVideoPlayer camId={cam.id} token={activeToken} type="main" />
                  <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[8px] font-bold group-hover:text-blue-400">
                    {cam.name}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SINGLE VIEW */}
          {view === 'live' && activeCam && (
            <div className="absolute inset-0 flex flex-col">
              <div className="flex-1 relative bg-black">
                <SmartVideoPlayer camId={activeCam.id} token={activeToken} offsetSeconds={dvrOffset} controls={true} />
                <div className="absolute top-6 left-6 flex gap-2">
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-black border ${dvrOffset === 0 ? 'bg-red-600/20 text-red-500 border-red-500/50' : 'bg-amber-600/20 text-amber-400 border-amber-500/50'}`}>
                    {dvrOffset === 0 ? '● LIVE' : `DVR (-${dvrOffset}s)`}
                  </span>
                  <span className="bg-black/60 backdrop-blur-md border border-white/10 px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest">{activeCam.name.toUpperCase()}</span>
                </div>
              </div>
              <div className="h-20 bg-white/5 border-t border-white/10 flex items-center px-8 gap-4 justify-center backdrop-blur-md">
                {[0, 30, 60, 300].map(s => (
                  <button key={s} onClick={() => setDvrOffset(s)} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${dvrOffset === s ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5'}`}>
                    {s === 0 ? 'LIVE FEED' : `-${s}s`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {view === 'incident' && activeCam && (
            <div className="absolute inset-0 flex">
              <div className="flex-1 border-r border-white/10 relative">
                <SmartVideoPlayer camId={activeCam.id} token={activeToken} offsetSeconds={15} />
                <span className="absolute bottom-6 left-6 bg-amber-600 px-3 py-1 rounded-lg text-[9px] font-black shadow-xl uppercase">Replay</span>
              </div>
              <div className="flex-1 relative">
                <SmartVideoPlayer camId={activeCam.id} token={activeToken} offsetSeconds={0} />
                <span className="absolute bottom-6 left-6 bg-red-600 px-3 py-1 rounded-lg text-[9px] font-black shadow-xl uppercase">Live</span>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div className="w-72 shrink-0 flex flex-col gap-4">
          <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 shadow-xl text-center">
            <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest border-b border-white/5 pb-2">Control</h3>
            <button className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl text-xs font-black shadow-lg shadow-blue-900/40 transition-all mb-3 active:scale-95">🔓 PULSE GATE</button>
            <button className="w-full bg-white/5 hover:bg-white/10 py-4 rounded-2xl text-[10px] font-black border border-white/10 transition-all active:scale-95 uppercase tracking-widest">Office Access</button>
          </div>
          
          <div className="bg-gradient-to-br from-indigo-900/20 to-transparent border border-indigo-500/20 rounded-[2rem] p-6 flex-1 shadow-2xl flex flex-col">
            <h3 className="text-[10px] font-black text-indigo-400 uppercase mb-6 tracking-widest text-center">Protocol</h3>
            <div className="space-y-4 opacity-40 flex-1">
              {["Verify Subject", "Match ID", "Log Entry"].map(t => (
                <div key={t} className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-white/20 rounded-lg bg-black/40"></div>
                  <span className="text-xs font-bold text-slate-300">{t}</span>
                </div>
              ))}
            </div>
            <button className="w-full bg-red-600 hover:bg-red-500 py-4 rounded-2xl text-[10px] font-black transition-all mt-10 shadow-lg shadow-red-900/40">FLAG INCIDENT</button>
          </div>
        </div>
      </div>
    </div>
  );
}
