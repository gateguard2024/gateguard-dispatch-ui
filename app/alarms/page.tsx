"use client";

import React, { useState, useEffect, useRef } from "react";

// ============================================================================
// 🏢 MOCK DATA (Will be replaced by Supabase + EEN API)
// ============================================================================
const MOCK_ALARMS = [
  {
    id: "ALM-001",
    time: "08:25:40 AM",
    site: "Marbella Place",
    cameraName: "Leasing Lobby",
    cameraId: "100c2e51", // Actual ESN
    event: "Motion Detected - Default Alarm",
    priority: 100
  },
  {
    id: "ALM-002",
    time: "08:55:34 AM",
    site: "Elevate Eagles Landing",
    cameraName: "Front Gate Entrance",
    cameraId: "10059648", // Actual ESN
    event: "Vehicle Detected - Gate Trigger",
    priority: 80
  }
];

const SITE_CAMERAS = [
  { id: "10059648", name: "Front Gate Entrance" },
  { id: "100ba88a", name: "Dumpster Area" },
  { id: "100ebfc5", name: "Main Gate Exit" },
  { id: "1009a37e", name: "Gym Interior" },
  { id: "100c2e51", name: "Leasing Lobby" }
];

// ============================================================================
// STABLE HLS PLAYER (Zero Handshake)
// ============================================================================
const SmartVideoPlayer = ({ camId, token, type = 'main', offsetSeconds = 0 }: any) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<any>(null);

    useEffect(() => {
        if (!camId || !token || !videoRef.current) return;
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
            if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = hlsUrl;
            } else if ((window as any).Hls && (window as any).Hls.isSupported()) {
                const hls = new (window as any).Hls({ enableWorker: true, lowLatencyMode: true });
                hls.loadSource(hlsUrl);
                hls.attachMedia(video);
                hlsRef.current = hls;
            }
        };

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

    return <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover bg-black" />;
};

// ============================================================================
// MAIN SOC INTERFACE
// ============================================================================
export default function AlarmsPage() {
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [processingAlarm, setProcessingAlarm] = useState<any | null>(null);
  const [unacknowledged, setUnacknowledged] = useState(MOCK_ALARMS.length);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [centerTab, setCenterTab] = useState<'cameras' | 'history' | 'notes'>('cameras');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 1. Get Token
  useEffect(() => {
    const token = localStorage.getItem(`een_token_Pegasus Properties - Marbella Place`);
    if (token) setActiveToken(token);
    
    // Create audio element for the alarm beep
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audioRef.current.loop = true;
  }, []);

  // 2. Alarm Beep Logic
  useEffect(() => {
    if (audioEnabled && audioRef.current) {
      if (unacknowledged > 0 && !processingAlarm) {
        audioRef.current.play().catch(() => console.log("Audio play blocked by browser"));
      } else {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, [unacknowledged, processingAlarm, audioEnabled]);

  const handleProcessAlarm = (alarm: any) => {
    setAudioEnabled(true); // User interacted, safe to play audio later if needed
    setProcessingAlarm(alarm);
  };

  const handleDismiss = () => {
    setUnacknowledged(prev => Math.max(0, prev - 1));
    setProcessingAlarm(null);
  };

  const isFlashing = unacknowledged > 0 && !processingAlarm;

  return (
    <div className="w-full h-full flex flex-col p-4 bg-[#030406] text-white overflow-hidden font-sans">
      
      {/* HEADER */}
      <div className={`flex justify-between items-center mb-4 border rounded-2xl p-4 backdrop-blur-md transition-all duration-500 ${isFlashing ? 'bg-red-950/40 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]' : 'bg-[#0a0c10] border-white/5 shadow-2xl'}`}>
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-black tracking-tighter">DISPATCH STATION</h1>
          {!audioEnabled && (
             <button onClick={() => setAudioEnabled(true)} className="bg-indigo-600 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest animate-pulse">Go On Duty (Enable Audio)</button>
          )}
        </div>

        <div className="flex gap-4">
            <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Alarms</span>
                <span className={`text-xl font-black ${unacknowledged > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{unacknowledged}</span>
            </div>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        
        {/* 🚨 LEFT: ALARM QUEUE */}
        <div className={`w-[350px] border rounded-[2rem] p-4 flex flex-col shadow-xl transition-all duration-500 ${isFlashing ? 'bg-red-950/20 border-red-500/50' : 'bg-[#0a0c10] border-white/5'}`}>
          <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest text-center border-b border-white/5 pb-2">Pending Events</h3>
          
          <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 pr-1">
            {MOCK_ALARMS.map((alarm) => (
              <div 
                key={alarm.id}
                className={`p-4 rounded-2xl border transition-all ${
                  processingAlarm?.id === alarm.id 
                    ? 'bg-indigo-600/20 border-indigo-500/50 shadow-inner' 
                    : isFlashing 
                      ? 'bg-red-600/10 border-red-500/30 hover:bg-red-600/20' 
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[9px] font-black uppercase tracking-widest ${processingAlarm?.id === alarm.id ? 'text-indigo-400' : 'text-red-400'}`}>Priority {alarm.priority}</span>
                  <span className="text-[9px] text-slate-400 font-mono">{alarm.time}</span>
                </div>
                <span className="text-sm font-bold text-white block truncate">{alarm.site}</span>
                <span className="text-xs text-slate-400 block truncate mb-3">{alarm.event}</span>
                
                <button 
                    onClick={() => handleProcessAlarm(alarm)}
                    className={`w-full py-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all ${processingAlarm?.id === alarm.id ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white hover:bg-indigo-600'}`}
                >
                    {processingAlarm?.id === alarm.id ? 'PROCESSING...' : 'PROCESS ALARM'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 🖥️ CENTER: PROCESSING CANVAS */}
        <div className="flex-1 bg-black border border-white/5 rounded-[2.5rem] relative overflow-hidden shadow-inner flex flex-col">
          {!processingAlarm ? (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#05070a]">
                 <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                     <span className="text-2xl">🛡️</span>
                 </div>
                 <span className="text-slate-500 text-[11px] font-black tracking-[0.5em] uppercase">Awaiting Operator Action</span>
             </div>
          ) : (
            <div className="flex-1 flex flex-col h-full">
                {/* TOP: Dual Video Players (IMMIX Style) */}
                <div className="h-[55%] flex border-b border-white/10">
                    <div className="flex-1 relative border-r border-white/10 bg-slate-950">
                        <SmartVideoPlayer camId={processingAlarm.cameraId} token={activeToken} offsetSeconds={15} />
                        <span className="absolute top-4 left-4 bg-amber-600 px-3 py-1 rounded-lg text-[9px] font-black shadow-xl uppercase tracking-widest border border-amber-400/50">Pre-Alarm Clip</span>
                    </div>
                    <div className="flex-1 relative bg-slate-950">
                        <SmartVideoPlayer camId={processingAlarm.cameraId} token={activeToken} offsetSeconds={0} />
                        <span className="absolute top-4 left-4 bg-red-600 px-3 py-1 rounded-lg text-[9px] font-black shadow-xl uppercase tracking-widest border border-red-400/50">Live Status</span>
                    </div>
                </div>

                {/* BOTTOM: Context Tabs */}
                <div className="flex-1 bg-[#0a0c10] flex flex-col">
                    <div className="flex border-b border-white/5 bg-black/40">
                        {[
                            { id: 'cameras', label: 'Site Cameras' },
                            { id: 'history', label: 'Event History' },
                            { id: 'notes', label: 'Operator Notes' }
                        ].map(tab => (
                            <button 
                                key={tab.id}
                                onClick={() => setCenterTab(tab.id as any)}
                                className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${centerTab === tab.id ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'border-transparent text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    
                    <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
                        {centerTab === 'cameras' && (
                            <div className="grid grid-cols-4 gap-3">
                                {SITE_CAMERAS.map(cam => (
                                    <div key={cam.id} className="bg-black border border-white/10 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 transition-all group">
                                        <span className="text-xl mb-2 opacity-50 group-hover:opacity-100 transition-all">📹</span>
                                        <span className="text-[10px] font-bold text-center leading-tight text-slate-300 group-hover:text-white">{cam.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {centerTab === 'history' && (
                            <div className="text-[10px] font-mono text-slate-500 text-center mt-10 uppercase tracking-widest">Supabase Event History Integration Pending</div>
                        )}
                        {centerTab === 'notes' && (
                            <textarea className="w-full h-full bg-black border border-white/10 rounded-xl p-4 text-sm font-mono text-white resize-none focus:outline-none focus:border-indigo-500 transition-all" placeholder="Enter incident notes here..."></textarea>
                        )}
                    </div>
                </div>
            </div>
          )}
        </div>

        {/* ⚡ RIGHT: ACTION CENTER */}
        <div className="w-[320px] shrink-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
          
          <div className={`bg-[#0a0c10] border rounded-[2rem] p-6 shadow-xl transition-all ${processingAlarm ? 'border-indigo-500/30' : 'border-white/5 opacity-50 pointer-events-none'}`}>
              <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest border-b border-white/5 pb-2">Hardware Control</h3>
              <div className="grid grid-cols-2 gap-3">
                  <button className="col-span-2 bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl text-[11px] font-black tracking-widest shadow-lg shadow-indigo-900/40 transition-all active:scale-95">
                      🔓 OPEN MAIN GATE
                  </button>
                  <button className="bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-500 py-3 rounded-xl text-[10px] font-black tracking-widest transition-all">
                      🔊 AUDIO OUT
                  </button>
                  <button className="bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 py-3 rounded-xl text-[10px] font-black tracking-widest transition-all">
                      🚨 SIREN
                  </button>
              </div>
          </div>

          <div className={`bg-[#0a0c10] border rounded-[2rem] p-6 shadow-xl transition-all ${processingAlarm ? 'border-white/5' : 'border-white/5 opacity-50 pointer-events-none'}`}>
              <h3 className="text-[10px] font-black text-slate-500 uppercase mb-3 tracking-widest">Site Contacts</h3>
              <div className="space-y-2">
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center group hover:bg-white/10 transition-all cursor-pointer">
                      <div>
                          <span className="text-[11px] font-bold block text-white">Local Police Dept</span>
                          <span className="text-[9px] text-slate-400 font-mono block">800-555-0199</span>
                      </div>
                      <span className="text-[10px] font-black text-indigo-400 opacity-0 group-hover:opacity-100 transition-all">CALL</span>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center group hover:bg-white/10 transition-all cursor-pointer">
                      <div>
                          <span className="text-[11px] font-bold block text-white">Courtesy Officer</span>
                          <span className="text-[9px] text-slate-400 font-mono block">Mitul Patel</span>
                      </div>
                      <span className="text-[10px] font-black text-indigo-400 opacity-0 group-hover:opacity-100 transition-all">CALL</span>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center group hover:bg-white/10 transition-all cursor-pointer">
                      <div>
                          <span className="text-[11px] font-bold block text-white">Property Manager</span>
                          <span className="text-[9px] text-slate-400 font-mono block">Sarah Jenkins</span>
                      </div>
                      <span className="text-[10px] font-black text-indigo-400 opacity-0 group-hover:opacity-100 transition-all">CALL</span>
                  </div>
              </div>
          </div>

          <div className={`bg-gradient-to-br from-[#0a0c10] to-[#030406] border rounded-[2rem] p-6 shadow-xl flex-1 flex flex-col transition-all ${processingAlarm ? 'border-red-500/20' : 'border-white/5 opacity-50 pointer-events-none'}`}>
              <h3 className="text-[10px] font-black text-red-400 uppercase mb-4 tracking-widest">Incident Resolution</h3>
              <div className="space-y-4 opacity-60 mb-6 flex-1">
                {["Visual Verification", "Verify Credentials", "Announce via Audio", "Log to Supabase"].map(t => (
                  <div key={t} className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-white/20 rounded-lg bg-black/40"></div>
                    <span className="text-[11px] font-bold text-slate-300">{t}</span>
                  </div>
                ))}
              </div>
              <button onClick={handleDismiss} className="w-full bg-red-600 hover:bg-red-500 py-4 rounded-2xl text-[10px] font-black transition-all shadow-lg shadow-red-900/40 tracking-widest text-white active:scale-95">
                  RESOLVE & DISMISS
              </button>
          </div>

        </div>
      </div>
    </div>
  );
}
