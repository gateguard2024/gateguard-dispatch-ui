"use client";

import React, { useState, useEffect, useRef } from "react";
import Hls from "hls.js";

// --- MOCK DATA FOR UI STRUCTURE ---
// In the future, this will be populated by your EEN API proxy calls
const MOCK_SITES = [
  { id: "SITE-8259", name: "Pegasus Properties - Marbella Place", cameras: [{ id: "10054b8c", name: "Amenity Hall" }, { id: "cam2", name: "Front Gate" }, { id: "cam3", name: "Pool Area" }] },
  { id: "SITE-8260", name: "Elevate Eagles Landing", cameras: [{ id: "cam4", name: "Leasing Office" }, { id: "cam5", name: "Dumpster" }] },
];

const MOCK_ALARMS = [
  { id: 1, siteName: "Pegasus Properties - Marbella Place", cameraId: "10054b8c", camName: "Amenity Hall", type: "Motion Detected", time: "00:12s", severity: "high" },
  { id: 2, siteName: "Elevate Eagles Landing", cameraId: "cam4", camName: "Leasing Office", type: "Person Loitering", time: "04:30s", severity: "medium" }
];

export default function AlarmsPage() {
  // --- CORE VIEW STATE ---
  const [leftPanelMode, setLeftPanelMode] = useState<"alarms" | "patrol">("alarms");
  const [canvasView, setCanvasView] = useState<"live" | "map">("live");
  const [rightPanelTab, setRightPanelTab] = useState<"action" | "controls" | "notes">("action");

  // --- ACTIVE SELECTION STATE ---
  const [activeSite, setActiveSite] = useState(MOCK_SITES[0]);
  const [activeAlarm, setActiveAlarm] = useState(MOCK_ALARMS[0]);
  const [activeCameraId, setActiveCameraId] = useState(MOCK_ALARMS[0].cameraId);
  const [activeCameraName, setActiveCameraName] = useState(MOCK_ALARMS[0].camName);

  // --- LIVE VIDEO STATE ---
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // 1. Fetch Stream URL whenever the active camera changes
  useEffect(() => {
    const fetchStream = async () => {
      // For this demo, we only have a real EEN token/ID for Marbella's Amenity Hall
      // If you click a fake camera, we'll just show the loading state
      if (activeCameraId !== "10054b8c") {
        setVideoUrl(null);
        return;
      }

      const token = localStorage.getItem(`een_token_${activeSite.name}`);
      if (!token) return;

      setIsVideoLoading(true);
      try {
        const response = await fetch('/api/een/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, siteName: activeSite.name, cameraId: activeCameraId })
        });

        const data = await response.json();
        if (response.ok && data.url) {
            setVideoUrl(data.url);
        } else {
            setVideoUrl(null);
        }
      } catch (err) {
        console.error("Stream Proxy Error:", err);
      } finally {
        setIsVideoLoading(false);
      }
    };

    fetchStream();
  }, [activeCameraId, activeSite.name]);

// 2. Attach HLS.js when we get a valid URL
  useEffect(() => {
    if (videoUrl && videoRef.current) {
      const token = localStorage.getItem(`een_token_${activeSite.name}`);
      
      // Pass the raw URL to hls.loadSource, NOT the proxied one.
      // We will let the xhrSetup handle the proxying for EVERYTHING.
      if (Hls.isSupported()) {
        const hls = new Hls({
            xhrSetup: function(xhr, url) {
                // If the URL is going to Eagle Eye, proxy it!
                if (url.includes('eagleeyenetworks.com')) {
                    const proxyUrl = `/api/een/proxy?url=${encodeURIComponent(url)}&token=${encodeURIComponent(token || '')}`;
                    xhr.open('GET', proxyUrl, true);
                } else {
                    // Otherwise, just load it normally
                    xhr.open('GET', url, true);
                }
            }
        });
        
        // Load the RAW url. xhrSetup will intercept this very first request and proxy it.
        hls.loadSource(videoUrl); 
        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoRef.current?.play().catch(e => console.error("Autoplay blocked:", e));
        });
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        // Native fallback (Safari doesn't use Hls.js, so we MUST proxy the initial URL here)
        const proxiedVideoUrl = `/api/een/proxy?url=${encodeURIComponent(videoUrl)}&token=${encodeURIComponent(token || '')}`;
        videoRef.current.src = proxiedVideoUrl;
        videoRef.current.addEventListener('loadedmetadata', () => {
          videoRef.current?.play().catch(e => console.error("Autoplay blocked:", e));
        });
      }
    }
  }, [videoUrl, activeSite.name]);
        // Load the RAW url. xhrSetup will intercept this very first request and proxy it.
        hls.loadSource(videoUrl); 
        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoRef.current?.play().catch(e => console.error("Autoplay blocked:", e));
        });
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        // Native fallback (Safari doesn't use Hls.js, so we MUST proxy the initial URL here)
        const proxiedVideoUrl = `/api/een/proxy?url=${encodeURIComponent(videoUrl)}&token=${encodeURIComponent(token || '')}`;
        videoRef.current.src = proxiedVideoUrl;
        videoRef.current.addEventListener('loadedmetadata', () => {
          videoRef.current?.play().catch(e => console.error("Autoplay blocked:", e));
        });
      }
    }
  }, [videoUrl, activeSite.name]);

  // Handler for clicking an alarm
  const handleAlarmClick = (alarm: any) => {
    setActiveAlarm(alarm);
    const site = MOCK_SITES.find(s => s.name === alarm.siteName) || MOCK_SITES[0];
    setActiveSite(site);
    setActiveCameraId(alarm.cameraId);
    setActiveCameraName(alarm.camName);
    setCanvasView("live");
  };

  // Handler for selecting a camera manually from the PIP row
  const handleCameraSelect = (camId: string, camName: string) => {
    setActiveCameraId(camId);
    setActiveCameraName(camName);
  };

  return (
    <div className="w-full h-full flex gap-6 p-6 relative bg-[#05070a]">
      
      {/* LEFT: TRIAGE & PATROL QUEUE */}
      <div className="w-80 flex flex-col gap-4 z-10 shrink-0">
        
        {/* Toggle Mode */}
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 backdrop-blur-md">
          <button onClick={() => setLeftPanelMode("alarms")} className={`flex-1 text-[10px] font-black tracking-widest py-2.5 rounded-lg transition-all ${leftPanelMode === "alarms" ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-inner" : "text-slate-400 hover:text-white"}`}>
            🚨 ALARMS (2)
          </button>
          <button onClick={() => setLeftPanelMode("patrol")} className={`flex-1 text-[10px] font-black tracking-widest py-2.5 rounded-lg transition-all ${leftPanelMode === "patrol" ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-inner" : "text-slate-400 hover:text-white"}`}>
            👁️ PATROLS
          </button>
        </div>
        
        {/* ALARMS MODE */}
        {leftPanelMode === "alarms" && (
          <div className="flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-2">
            {MOCK_ALARMS.map((alarm) => (
              <div key={alarm.id} onClick={() => handleAlarmClick(alarm)} className={`rounded-2xl p-4 cursor-pointer relative overflow-hidden transition-all ${activeAlarm.id === alarm.id ? 'bg-gradient-to-br from-slate-800 to-slate-900 border border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.15)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                {activeAlarm.id === alarm.id && <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500"></div>}
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${activeAlarm.id === alarm.id ? 'bg-rose-500/20 text-rose-400' : 'text-slate-500 border border-slate-700'}`}>NEW EVENT</span>
                  <span className="text-[10px] font-mono text-rose-400 font-bold animate-pulse">{alarm.time}</span>
                </div>
                <h3 className={`font-bold text-lg leading-tight mb-1 ${activeAlarm.id === alarm.id ? 'text-white' : 'text-slate-300'}`}>{alarm.siteName.split('-')[1] || alarm.siteName}</h3>
                <p className="text-slate-400 text-xs">{alarm.camName} • {alarm.type}</p>
              </div>
            ))}
          </div>
        )}

        {/* PATROL MODE (Spot Checks) */}
        {leftPanelMode === "patrol" && (
          <div className="flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">Select Site to Tour</p>
            {MOCK_SITES.map((site) => (
              <div key={site.id} onClick={() => { setActiveSite(site); setActiveCameraId(site.cameras[0].id); setActiveCameraName(site.cameras[0].name); }} className={`rounded-2xl p-4 cursor-pointer border transition-all ${activeSite.id === site.id ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                <h3 className="font-bold text-sm text-white mb-1">{site.name}</h3>
                <p className="text-slate-500 text-xs">{site.cameras.length} Cameras Available</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CENTER: THE IMMERSIVE CANVAS */}
      <div className="flex-1 relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-black flex flex-col group">
        
        {/* Canvas Header */}
        <div className="absolute top-0 w-full p-6 bg-gradient-to-b from-black/90 via-black/50 to-transparent flex justify-between items-start z-30 pointer-events-none">
          <div className="pointer-events-auto flex flex-col gap-2">
            <h1 className="text-3xl font-black text-white tracking-wide drop-shadow-lg flex items-center">
              <span className={`w-3 h-3 rounded-full mr-4 shadow-[0_0_15px_currentColor] ${leftPanelMode === 'alarms' ? 'bg-rose-500 text-rose-500' : 'bg-indigo-500 text-indigo-500'}`}></span>
              {activeSite.name.split('-')[1] || activeSite.name}
            </h1>
            <div className="flex items-center gap-2">
               <span className="bg-black/50 backdrop-blur-md border border-white/10 px-3 py-1 rounded-lg text-xs font-bold text-white">🎥 {activeCameraName}</span>
               {leftPanelMode === 'alarms' && <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 px-3 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase animate-pulse">MOTION TRIGGER</span>}
            </div>
          </div>

          <div className="flex gap-2 bg-black/60 backdrop-blur-xl p-1.5 rounded-xl border border-white/10 pointer-events-auto shadow-2xl">
            <button onClick={() => setCanvasView("live")} className={`px-5 py-2 text-xs font-black tracking-widest rounded-lg transition-all ${canvasView === "live" ? "bg-white/20 text-white shadow-inner" : "text-slate-400 hover:text-white"}`}>LIVE FEED</button>
            <button onClick={() => setCanvasView("map")} className={`px-5 py-2 text-xs font-black tracking-widest rounded-lg transition-all ${canvasView === "map" ? "bg-emerald-500/20 text-emerald-400 shadow-inner border border-emerald-500/30" : "text-slate-400 hover:text-white"}`}>TACTICAL MAP</button>
          </div>
        </div>

        {/* CANVAS RENDERER */}
        {canvasView === "live" ? (
          <div className="flex-1 w-full h-full relative flex items-center justify-center bg-[#0a0f18] overflow-hidden">
            
            {/* MAIN VIDEO FEED */}
            {videoUrl ? (
                <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-90" autoPlay muted playsInline />
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 border-2 border-dashed border-white/10 m-4 rounded-3xl">
                    {isVideoLoading ? (
                        <span className="text-emerald-500 text-sm font-bold tracking-widest animate-pulse">CONNECTING TO EEN STREAM...</span>
                    ) : (
                        <span className="text-slate-500 text-sm font-bold tracking-widest">CAMERA OFFLINE / NO STREAM URL</span>
                    )}
                </div>
            )}
            
            {/* BOTTOM LEFT: The "Event Snapshot" PIP (Only visible during Alarms) */}
            {leftPanelMode === "alarms" && (
                <div className="absolute bottom-6 left-6 w-80 aspect-video bg-black rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)] border-2 border-rose-500/50 z-20 group/pip hover:scale-105 transition-transform cursor-pointer origin-bottom-left">
                  <div className="absolute top-2 left-2 bg-rose-600 backdrop-blur px-2 py-0.5 rounded text-[9px] font-black text-white uppercase tracking-wider z-10 shadow-md">EVENT SNAPSHOT</div>
                  {/* Placeholder for the recorded clip or image that triggered the alarm */}
                  <img src="https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=2070&auto=format&fit=crop" alt="Event Snapshot" className="w-full h-full object-cover opacity-80" />
                </div>
            )}

            {/* BOTTOM RIGHT: Other Cameras at this Site */}
            <div className="absolute bottom-6 right-6 flex gap-3 z-20 overflow-x-auto max-w-[50%] snap-x p-1 custom-scrollbar">
                {activeSite.cameras.map((cam) => (
                    <div 
                        key={cam.id} 
                        onClick={() => handleCameraSelect(cam.id, cam.name)}
                        className={`shrink-0 w-36 aspect-video bg-black/80 backdrop-blur-md border-2 rounded-xl cursor-pointer flex flex-col justify-end p-2 snap-center relative overflow-hidden transition-all hover:scale-105 origin-bottom ${activeCameraId === cam.id ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'border-white/20 hover:border-white/50'}`}
                    >
                        <span className="text-[10px] font-bold text-white drop-shadow-md relative z-10 bg-black/70 px-1.5 py-0.5 rounded w-fit">{cam.name}</span>
                        {activeCameraId === cam.id && <span className="absolute top-2 right-2 flex h-2 w-2 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>}
                    </div>
                ))}
            </div>

          </div>
        ) : (
          /* TACTICAL MAP RENDERER */
          <div className="flex-1 w-full h-full relative bg-[#17263c] overflow-hidden">
             <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=2074&auto=format&fit=crop" alt="Tactical Map" className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-screen grayscale" />
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                <div className={`absolute -inset-8 rounded-full animate-ping ${leftPanelMode === 'alarms' ? 'bg-rose-500/20' : 'bg-indigo-500/20'}`}></div>
                <div className={`relative w-6 h-6 rounded-full border-[3px] border-white flex items-center justify-center shadow-[0_0_20px_currentColor] ${leftPanelMode === 'alarms' ? 'bg-rose-500 text-rose-500' : 'bg-indigo-500 text-indigo-500'}`}>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
             </div>
          </div>
        )}
      </div>

      {/* RIGHT: DYNAMIC ACTION DRAWER */}
      <div className="w-[360px] flex flex-col gap-4 z-10 shrink-0">
        <div className="flex bg-white/5 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl shrink-0">
          <button onClick={() => setRightPanelTab("action")} className={`flex-1 text-[10px] font-black uppercase py-2.5 rounded-xl transition-all tracking-wider ${rightPanelTab === "action" ? "bg-white/20 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}>Action & SOP</button>
          <button onClick={() => setRightPanelTab("controls")} className={`flex-1 text-[10px] font-black uppercase py-2.5 rounded-xl transition-all tracking-wider ${rightPanelTab === "controls" ? "bg-white/20 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}>Controls</button>
        </div>

        <div className="flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 flex flex-col shadow-2xl relative overflow-hidden min-h-0">
          {rightPanelTab === "action" && (
            <div className="flex flex-col h-full">
                <h2 className="text-[10px] font-black text-slate-500 tracking-[0.2em] mb-4">SOP & RESOLUTION</h2>
                <div className="space-y-3 mb-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    <label className="flex items-start space-x-3 cursor-pointer group">
                    <input type="checkbox" className="mt-1 w-4 h-4 rounded border-slate-600 bg-black/50 text-emerald-500" />
                    <span className="text-sm text-slate-300 group-hover:text-white transition-colors">Confirm visual via live feed.</span>
                    </label>
                </div>
                <div className="shrink-0 pt-4 border-t border-white/10">
                    <h2 className="text-[10px] font-black text-slate-500 tracking-[0.2em] mb-3">QUICK RESOLVE</h2>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        <button className="bg-slate-800 text-[10px] text-white font-bold py-2.5 rounded-xl border border-slate-700">NOTHING SEEN</button>
                        <button className="bg-emerald-900/40 text-[10px] text-emerald-400 font-bold py-2.5 rounded-xl border border-emerald-500/30">AUTH GUEST</button>
                    </div>
                    <button className="w-full bg-blue-600 text-white font-black py-3.5 rounded-xl text-xs tracking-widest shadow-lg">LOG TO BRIVO & CLOSE</button>
                </div>
            </div>
          )}
          
          {rightPanelTab === "controls" && (
             <div className="flex flex-col h-full text-white text-sm">
                 <p className="text-slate-400 text-xs mb-4">Site hardware controls will render here.</p>
             </div>
          )}
        </div>
      </div>

    </div>
  );
}
