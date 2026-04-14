"use client";

import React, { useState, useEffect, useRef } from "react";

// ============================================================================
// 🏢 SITE DATA
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
// SIMPLE VIDEO RENDERER (No Logic, Just Playback)
// ============================================================================
const VideoStream = ({ hlsUrl, controls = false }: { hlsUrl: string; controls?: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!hlsUrl || !videoRef.current) return;
    const video = videoRef.current;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl;
    } else if ((window as any).Hls && (window as any).Hls.isSupported()) {
      const hls = new (window as any).Hls();
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
    }
  }, [hlsUrl]);

  return <video ref={videoRef} autoPlay muted playsInline controls={controls} className="w-full h-full object-cover bg-black" />;
};

// ============================================================================
// MAIN SOC INTERFACE
// ============================================================================
export default function AlarmsPage() {
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [streamMap, setStreamMap] = useState<Record<string, string>>({});
  const [activeCamId, setActiveCamId] = useState<string>(MARBELLA_CAMERAS[1].id); // Default to Gate
  const [view, setView] = useState<"grid" | "live" | "incident">("grid");
  const [loading, setLoading] = useState(true);

  // 1. Get Token
  useEffect(() => {
    const token = localStorage.getItem(`een_token_${SITE_NAME}`);
    if (token) setActiveToken(token);
  }, []);

  // 2. Fetch ALL feeds in ONE request (The V3 Doc Method)
  useEffect(() => {
    if (!activeToken) return;

    const fetchAllFeeds = async () => {
      setLoading(true);
      try {
        const esnList = MARBELLA_CAMERAS.map((c) => c.id).join(",");
        // Docs: use deviceId__in to batch requests and include=hlsUrl
        const apiUrl = `https://media.c031.eagleeyenetworks.com/api/v3.0/feeds?deviceId__in=${esnList}&include=hlsUrl`;
        
        const res = await fetch(`/api/een/proxy?url=${encodeURIComponent(apiUrl)}&token=${encodeURIComponent(activeToken)}`);
        
        if (!res.ok) throw new Error("Batch Feed Fetch Failed");

        const data = await res.json();
        const results = data.results || [];

        // Map ESN to its specific authorized hlsUrl
        const newMap: Record<string, string> = {};
        results.forEach((item: any) => {
          if (item.deviceId && item.hlsUrl) {
            // Append &A= token for segment authorization as per EEN V3 security docs
            newMap[item.deviceId] = `${item.hlsUrl}&A=${activeToken}`;
          }
        });

        setStreamMap(newMap);
      } catch (err) {
        console.error("SOC Error:", err);
      } finally {
        setLoading(false);
      }
    };

    // Load HLS.js Script once
    if (!(window as any).Hls) {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
      script.onload = fetchAllFeeds;
      document.head.appendChild(script);
    } else {
      fetchAllFeeds();
    }
  }, [activeToken]);

  const activeCamName = MARBELLA_CAMERAS.find(c => c.id === activeCamId)?.name || "Unknown";

  return (
    <div className="w-full h-full flex flex-col p-4 bg-[#05070a] text-white font-sans overflow-hidden">
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-4 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
        <div>
          <h1 className="text-xl font-black tracking-tighter">SOC COMMAND DECK</h1>
          <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">{SITE_NAME}</p>
        </div>

        <div className="flex bg-black/40 border border-white/10 rounded-xl p-1">
          {["grid", "live", "incident"].map((v) => (
            <button
              key={v}
              onClick={() => setView(v as any)}
              className={`px-6 py-2 rounded-lg text-[10px] font-black tracking-widest transition-all ${
                view === v ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-white"
              }`}
            >
              {v.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        
        {/* LEFT LIST */}
        <div className="w-72 bg-white/5 border border-white/10 rounded-[2rem] p-4 flex flex-col shadow-xl">
          <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest text-center border-b border-white/5 pb-2">Site Nodes</h3>
          <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1">
            {MARBELLA_CAMERAS.map((cam) => (
              <div
                key={cam.id}
                onClick={() => { setActiveCamId(cam.id); setView("live"); }}
                className={`p-4 rounded-2xl cursor-pointer transition-all border ${
                  activeCamId === cam.id ? "bg-blue-600/20 border-blue-500/50 shadow-inner" : "bg-white/5 border-transparent hover:bg-white/10"
                }`}
              >
                <span className="text-sm font-bold block truncate">{cam.name}</span>
                <span className="text-[8px] text-slate-500 font-mono">ID: {cam.id}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER VIEWPORT */}
        <div className="flex-1 bg-black border border-white/10 rounded-[2.5rem] relative overflow-hidden shadow-2xl flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {/* GRID VIEW */}
              {view === "grid" && (
                <div className="absolute inset-0 p-4 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto custom-scrollbar">
                  {MARBELLA_CAMERAS.map((cam) => (
                    <div
                      key={cam.id}
                      onDoubleClick={() => { setActiveCamId(cam.id); setView("live"); }}
                      className="aspect-video bg-slate-900 border border-white/10 rounded-2xl overflow-hidden relative cursor-pointer hover:border-blue-500 transition-all shadow-lg group"
                    >
                      {streamMap[cam.id] ? (
                        <VideoStream hlsUrl={streamMap[cam.id]} />
                      ) : (
                        <div className="flex items-center justify-center h-full text-[8px] text-slate-700">NO FEED</div>
                      )}
                      <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[8px] font-bold group-hover:text-blue-400">
                        {cam.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* SINGLE LIVE */}
              {view === "live" && streamMap[activeCamId] && (
                <div className="absolute inset-0 flex flex-col">
                  <div className="flex-1 relative">
                    <VideoStream hlsUrl={streamMap[activeCamId]} controls={true} />
                    <div className="absolute top-6 left-6 flex gap-2">
                      <span className="bg-red-600/20 text-red-500 border border-red-500/50 px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest shadow-lg uppercase">
                        ● Live
                      </span>
                      <span className="bg-black/60 backdrop-blur-md border border-white/10 px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase">
                        {activeCamName}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* INCIDENT SPLIT */}
              {view === "incident" && streamMap[activeCamId] && (
                <div className="absolute inset-0 flex">
                  <div className="flex-1 border-r border-white/10 relative bg-slate-950">
                    <VideoStream hlsUrl={streamMap[activeCamId]} />
                    <span className="absolute bottom-6 left-6 bg-amber-600 px-3 py-1 rounded-lg text-[9px] font-black shadow-xl uppercase">Event Analysis</span>
                  </div>
                  <div className="flex-1 relative">
                    <VideoStream hlsUrl={streamMap[activeCamId]} />
                    <span className="absolute bottom-6 left-6 bg-red-600 px-3 py-1 rounded-lg text-[9px] font-black shadow-xl uppercase">Live Status</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div className="w-72 shrink-0 flex flex-col gap-4">
          <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 shadow-xl text-center">
            <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Hardware</h3>
            <button className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl text-xs font-black shadow-lg shadow-blue-900/40 transition-all mb-3 active:scale-95">🔓 PULSE GATE</button>
            <button className="w-full bg-white/5 hover:bg-white/10 py-4 rounded-2xl text-[10px] font-black border border-white/10 transition-all active:scale-95 uppercase tracking-widest">Office Access</button>
          </div>
          
          <div className="bg-gradient-to-br from-indigo-900/20 to-transparent border border-indigo-500/20 rounded-[2rem] p-6 flex-1 shadow-2xl">
            <h3 className="text-[10px] font-black text-indigo-400 uppercase mb-6 tracking-widest text-center border-b border-white/5 pb-2">Protocol</h3>
            <div className="space-y-4 opacity-40">
              {["Verify Subject", "Match ID", "Log Incident"].map(t => (
                <div key={t} className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-white/20 rounded-lg"></div>
                  <span className="text-xs font-bold text-slate-300">{t}</span>
                </div>
              ))}
            </div>
            <button className="w-full bg-red-600 hover:bg-red-500 py-4 rounded-2xl text-[10px] font-black transition-all mt-10 shadow-lg shadow-red-900/40">FLAG EVENT</button>
          </div>
        </div>
      </div>
    </div>
  );
}
