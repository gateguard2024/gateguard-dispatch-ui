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
// THE MARBELLA PLAYER (Stable HLS + V3 Handshake)
// ============================================================================
const SmartVideoPlayer = ({ camId, token, type = 'main', offsetSeconds = 0 }: any) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!camId || !token || !videoRef.current) return;
        setLoading(true);

        const initSessionAndPlay = async () => {
            try {
                // 1. Ask EEN for a pre-authorized HLS URL (Using Cluster c031)
                const clusterBase = "https://media.c031.eagleeyenetworks.com";
                const apiUrl = `${clusterBase}/api/v3.0/feeds?deviceId=${camId}&type=${type}&include=hlsUrl`;
                
                const res = await fetch(`/api/een/proxy?url=${encodeURIComponent(apiUrl)}&token=${encodeURIComponent(token)}`);
                if (!res.ok) throw new Error(`Auth Fail: ${res.status}`);
                
                const data = await res.json();
                const hlsUrl = data.results?.[0]?.hlsUrl;
                if (!hlsUrl) throw new Error("No URL in response");

                // 2. Initialize HLS.js for Chrome stability
                const video = videoRef.current!;
                
                const play = () => {
                    if (hlsRef.current) hlsRef.current.destroy();
                    
                    if (video.canPlayType('application/vnd.apple.mpegurl')) {
                        video.src = hlsUrl;
                    } else if ((window as any).Hls && (window as any).Hls.isSupported()) {
                        const hls = new (window as any).Hls({ enableWorker: true });
                        hls.loadSource(hlsUrl);
                        hls.attachMedia(video);
                        hlsRef.current = hls;
                    }
                    setLoading(false);
                };

                // Inject script if missing, then play
                if (!(window as any).Hls) {
                    const script = document.createElement("script");
                    script.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
                    script.onload = play;
                    document.head.appendChild(script);
                } else {
                    play();
                }
            } catch (err) {
                console.error(`[Player Error] ${camId}:`, err);
                setLoading(false);
            }
        };

        // Small delay to prevent hammering the API with 11 requests at the exact same microsecond
        const delay = Math.random() * 1000;
        const timer = setTimeout(initSessionAndPlay, delay);
        
        return () => {
            clearTimeout(timer);
            if (hlsRef.current) hlsRef.current.destroy();
        };
    }, [camId, token, type]);

    return (
        <div className="relative w-full h-full bg-black overflow-hidden group">
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
                    <div className="w-4 h-4 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                </div>
            )}
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
        </div>
    );
};

export default function AlarmsPage() {
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [activeCam, setActiveCam] = useState<any>(MARBELLA_CAMERAS[0]);
  const [view, setView] = useState<'grid' | 'live' | 'incident' | 'map'>('grid');
  const [isPatrol, setIsPatrol] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(`een_token_${SITE_NAME}`);
    if (token) setActiveToken(token);
  }, []);

  // Patrol Logic
  useEffect(() => {
    let t: any;
    if (isPatrol) {
      setView('live');
      t = setInterval(() => {
        setActiveCam((p: any) => {
          const i = MARBELLA_CAMERAS.findIndex(c => c.id === p.id);
          return MARBELLA_CAMERAS[(i + 1) % MARBELLA_CAMERAS.length];
        });
      }, 8000);
    }
    return () => clearInterval(t);
  }, [isPatrol]);

  return (
    <div className="w-full h-full flex flex-col p-4 bg-[#020408] text-white font-sans overflow-hidden">
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-4 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
        <div>
          <h1 className="text-xl font-black tracking-tighter">SOC COMMAND DECK</h1>
          <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">{SITE_NAME}</p>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsPatrol(!isPatrol)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all border ${isPatrol ? 'bg-amber-500 border-amber-600 text-black animate-pulse' : 'bg-white/5 border-white/10 text-slate-400'}`}
          >
            {isPatrol ? '● PATROL ACTIVE' : 'START PATROL'}
          </button>
          
          <div className="flex bg-black/40 border border-white/10 rounded-xl p-1">
            {['grid', 'live', 'incident', 'map'].map(v => (
              <button 
                key={v}
                onClick={() => { setView(v as any); setIsPatrol(false); }}
                className={`px-5 py-2 rounded-lg text-[10px] font-black transition-all ${view === v ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
              >
                {v.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        
        {/* LEFT: SITE LIST */}
        <div className="w-72 bg-white/5 border border-white/10 rounded-[2rem] p-4 flex flex-col shadow-2xl">
          <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest text-center border-b border-white/5 pb-2">Active Nodes</h3>
          <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1">
            {MARBELLA_CAMERAS.map((cam) => (
              <div 
                key={cam.id} 
                onClick={() => { setActiveCam(cam); setView('live'); setIsPatrol(false); }}
                className={`p-4 rounded-2xl cursor-pointer transition-all border ${activeCam?.id === cam.id ? 'bg-blue-600/20 border-blue-500/50' : 'bg-white/5 border-transparent hover:bg-white/10'}`}
              >
                <span className="text-sm font-bold block truncate">{cam.name}</span>
                <span className="text-[8px] text-slate-600 font-mono mt-1">ESN: {cam.id}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER: VIEWPORT */}
        <div className="flex-1 bg-black border border-white/10 rounded-[2.5rem] relative overflow-hidden shadow-inner flex flex-col">
          
          {view === 'grid' && (
            <div className="absolute inset-0 p-4 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto custom-scrollbar">
              {MARBELLA_CAMERAS.map(cam => (
                <div key={cam.id} onDoubleClick={() => { setActiveCam(cam); setView('live'); }} className="aspect-video bg-slate-900 border border-white/10 rounded-2xl overflow-hidden relative cursor-pointer group hover:border-blue-500 transition-all shadow-lg">
                  <SmartVideoPlayer camId={cam.id} token={activeToken} type="preview" />
                  <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[8px] font-bold border border-white/5 group-hover:text-blue-400">{cam.name}</div>
                </div>
              ))}
            </div>
          )}

          {view === 'live' && activeCam && (
            <div className="absolute inset-0 flex flex-col bg-black">
                <SmartVideoPlayer camId={activeCam.id} token={activeToken} />
                <div className="absolute top-6 left-6 flex gap-2">
                  <span className="bg-red-600/20 text-red-500 border border-red-500/50 px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest shadow-lg">● LIVE FEED</span>
                  <span className="bg-black/60 backdrop-blur-md border border-white/10 px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest">{activeCam.name.toUpperCase()}</span>
                </div>
            </div>
          )}

          {view === 'incident' && activeCam && (
            <div className="absolute inset-0 flex">
              <div className="flex-1 border-r border-white/10 relative">
                <SmartVideoPlayer camId={activeCam.id} token={activeToken} />
                <span className="absolute bottom-6 left-6 bg-amber-600 px-3 py-1 rounded-lg text-[9px] font-black shadow-xl">EVENT ANALYSIS</span>
              </div>
              <div className="flex-1 relative">
                <SmartVideoPlayer camId={activeCam.id} token={activeToken} />
                <span className="absolute bottom-6 left-6 bg-red-600 px-3 py-1 rounded-lg text-[9px] font-black shadow-xl">LIVE STATUS</span>
              </div>
            </div>
          )}

          {view === 'map' && <div className="absolute inset-0 flex items-center justify-center text-slate-800 text-[10px] font-black tracking-[1em] uppercase">Interactive Map Pending</div>}
        </div>

        {/* RIGHT: COMMANDS */}
        <div className="w-72 shrink-0 flex flex-col gap-4">
          <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 shadow-xl text-center">
            <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Property Control</h3>
            <button className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl text-xs font-black shadow-lg shadow-blue-900/40 transition-all mb-3 active:scale-95">🔓 PULSE MAIN GATE</button>
            <button className="w-full bg-white/5 hover:bg-white/10 py-4 rounded-2xl text-[10px] font-black border border-white/10 transition-all active:scale-95 uppercase tracking-widest">Office Access</button>
          </div>
          
          <div className="bg-gradient-to-br from-indigo-900/20 to-transparent border border-indigo-500/20 rounded-[2rem] p-6 flex-1 shadow-2xl flex flex-col">
            <h3 className="text-[10px] font-black text-indigo-400 uppercase mb-6 tracking-widest text-center border-b border-white/5 pb-2">Protocol</h3>
            <div className="space-y-4 opacity-40 flex-1">
              {["Subject Check", "ID Match", "Log Incident"].map(t => (
                <div key={t} className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-white/20 rounded-lg bg-black/40"></div>
                  <span className="text-xs font-bold text-slate-300">{t}</span>
                </div>
              ))}
            </div>
            <button className="w-full bg-red-600 hover:bg-red-500 py-4 rounded-2xl text-[10px] font-black transition-all mt-10 shadow-lg shadow-red-900/40 uppercase">Flag to Database</button>
          </div>
        </div>
      </div>
    </div>
  );
}
