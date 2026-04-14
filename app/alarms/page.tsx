"use client";

import React, { useState, useEffect, useRef } from "react";

// ============================================================================
// MOCK DATA (The "Sockets" for our future API hookups)
// ============================================================================
const MOCK_ALARMS = [
  { id: "al-01", time: "2 Mins Ago", camId: "10054b8d", camName: "Front Gate", type: "Motion Detected", priority: "high", handled: false },
  { id: "al-02", time: "15 Mins Ago", camId: "10054b8c", camName: "Amenity Hall", type: "Door Forced Open", priority: "critical", handled: false },
  { id: "al-03", time: "1 Hour Ago", camId: "10054b8e", camName: "Pool Area", type: "Loitering", priority: "medium", handled: true },
];

const MOCK_DOORS = [
  { id: "door-1", name: "Front Gate Barrier", status: "Locked" },
  { id: "door-2", name: "Amenity Hall Main", status: "Locked" },
  { id: "door-3", name: "Pool Gate", status: "Unlocked" },
];

const MOCK_SOPS = [
  "Visual verification of subject",
  "Check Brivo access logs for credential",
  "Trigger audio talk-down",
  "Log incident or dispatch authorities"
];

// ============================================================================
// MAIN SOC COMPONENT
// ============================================================================
export default function AlarmsPage() {
  // --- CORE STATE ---
  const [activeSite, setActiveSite] = useState({ name: "Pegasus Properties - Marbella Place", id: "SITE-8259" });
  const [activeToken, setActiveToken] = useState<string | null>(null);
  
  // The 11 cameras you provisioned
  const [dynamicCameras, setDynamicCameras] = useState<any[]>([
    { id: "10054b8c", name: "Amenity Hall" },
    { id: "10054b8d", name: "Front Gate" },
    { id: "10054b8e", name: "Pool Area" },
    { id: "10054b8f", name: "Leasing Office" },
    { id: "10054b90", name: "Dumpster" },
  ]);
  
  const [activeCameraId, setActiveCameraId] = useState<string | null>("10054b8c");
  const [activeCameraName, setActiveCameraName] = useState<string>("Amenity Hall");

  // --- SOC VIEW STATE ---
  type CanvasMode = 'grid' | 'live' | 'incident' | 'map';
  const [canvasView, setCanvasView] = useState<CanvasMode>('grid');
  
  // DVR & Automation State
  const [dvrOffset, setDvrOffset] = useState<number>(0); // 0 = Live
  const [isPatrolMode, setIsPatrolMode] = useState(false);
  const patrolIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- LOAD EEN TOKEN ---
  useEffect(() => {
    const token = localStorage.getItem(`een_token_${activeSite.name}`);
    if (token) setActiveToken(token);
  }, [activeSite]);

  // --- VIRTUAL PATROL LOGIC ---
  useEffect(() => {
    if (isPatrolMode) {
      setCanvasView('live'); // Force single cam view for patrol
      let currentIndex = dynamicCameras.findIndex(c => c.id === activeCameraId);
      
      patrolIntervalRef.current = setInterval(() => {
        currentIndex = (currentIndex + 1) % dynamicCameras.length;
        setActiveCameraId(dynamicCameras[currentIndex].id);
        setActiveCameraName(dynamicCameras[currentIndex].name);
      }, 10000); // Switch camera every 10 seconds
    } else {
      if (patrolIntervalRef.current) clearInterval(patrolIntervalRef.current);
    }
    return () => { if (patrolIntervalRef.current) clearInterval(patrolIntervalRef.current); };
  }, [isPatrolMode, dynamicCameras, activeCameraId]);

  // --- HELPER: DVR TIMESTAMP ---
  const getEenTimestamp = (offsetSeconds: number) => {
    if (offsetSeconds === 0) return null;
    const d = new Date(Date.now() - offsetSeconds * 1000);
    const pad = (n: number, w = 2) => String(n).padStart(w, '0');
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}.000`;
  };

  // --- MOCK API ACTIONS ---
  const handleUnlockDoor = (doorId: string, doorName: string) => {
    // TODO: Wire up `POST /api/brivo/doors/${doorId}/access`
    console.log(`BRIVO API: Unlocking ${doorName} (${doorId})`);
    alert(`Brivo API Triggered: Unlocked ${doorName}`);
  };

  const handleFlagEvent = () => {
    // TODO: Wire up Supabase Insert
    console.log(`SUPABASE: Flagged event on ${activeCameraId} at -${dvrOffset}s`);
    alert(`Incident logged to database for ${activeCameraName}.`);
  };

  const handleAlarmClick = (alarm: any) => {
    setActiveCameraId(alarm.camId);
    setActiveCameraName(alarm.camName);
    setDvrOffset(15); // Auto-rewind 15 seconds to see the trigger
    setCanvasView('incident');
    setIsPatrolMode(false);
  };

  // --- VIDEO URL GENERATOR (PRESERVES YOUR PROXY!) ---
  const generateStreamUrl = (camId: string, streamType: 'preview' | 'primary', offsetSeconds: number = 0) => {
    if (!activeToken || !camId) return '';
    const cluster = "https://media.c031.eagleeyenetworks.com"; // Simplified for now
    let hlsUrl = `${cluster}/media/streams/${streamType}/hls/getPlaylist.m3u8?esn=${camId}`;
    
    const startTime = getEenTimestamp(offsetSeconds);
    if (startTime) hlsUrl += `&startTime=${startTime}`;
    
    return `/api/een/proxy?url=${encodeURIComponent(hlsUrl)}&token=${encodeURIComponent(activeToken)}`;
  };

  return (
    <div className="w-full h-full flex flex-col p-4 bg-[#05070a] overflow-hidden text-white font-sans">
      
      {/* TOP COMMAND DECK */}
      <div className="flex justify-between items-center mb-4 z-20 bg-white/5 border border-white/10 rounded-2xl p-3 backdrop-blur-md">
        <div className="flex items-center gap-4">
            <h1 className="text-2xl font-black tracking-tight text-white">{activeSite.name}</h1>
            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 px-2 py-0.5 rounded text-[10px] font-black tracking-widest">
                {activeToken ? "SYSTEM ONLINE" : "VMS DISCONNECTED"}
            </span>
        </div>

        {/* VIEW TOGGLES */}
        <div className="flex bg-black/50 border border-white/10 rounded-xl p-1 shadow-inner">
            {[
                { id: 'grid', label: 'VIDEO WALL' },
                { id: 'live', label: 'SINGLE CAM' },
                { id: 'incident', label: 'DUAL PANE' },
                { id: 'map', label: 'SITE MAP' }
            ].map(view => (
                <button 
                    key={view.id}
                    onClick={() => setCanvasView(view.id as CanvasMode)} 
                    className={`px-4 py-2 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all ${canvasView === view.id ? 'bg-indigo-600 shadow-[0_0_15px_rgba(79,70,229,0.4)] text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                    {view.label}
                </button>
            ))}
        </div>

        {/* PATROL TOGGLE */}
        <button 
            onClick={() => setIsPatrolMode(!isPatrolMode)}
            className={`flex items-center gap-2 px-6 py-2 rounded-xl font-black text-xs tracking-widest transition-all border ${isPatrolMode ? 'bg-amber-500/20 border-amber-500 text-amber-400 animate-pulse' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
        >
            <div className={`w-2 h-2 rounded-full ${isPatrolMode ? 'bg-amber-400' : 'bg-slate-600'}`}></div>
            {isPatrolMode ? 'PATROL ACTIVE' : 'START PATROL'}
        </button>
      </div>

      {/* 3-COLUMN LAYOUT */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        
        {/* ==================================================================== */}
        {/* LEFT PANEL: ALARM QUEUE & HISTORY */}
        {/* ==================================================================== */}
        <div className="w-80 shrink-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md flex-1">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex justify-between">
                    Alarm Queue <span className="bg-red-500 text-white px-1.5 rounded">2</span>
                </h3>
                
                <div className="flex flex-col gap-2">
                    {MOCK_ALARMS.map(alarm => (
                        <div 
                            key={alarm.id} 
                            onClick={() => handleAlarmClick(alarm)}
                            className={`p-3 rounded-xl border cursor-pointer transition-all ${alarm.handled ? 'bg-black/40 border-white/5 opacity-50' : 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20'}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${alarm.handled ? 'text-slate-500' : 'text-red-400'}`}>{alarm.type}</span>
                                <span className="text-[9px] text-slate-500">{alarm.time}</span>
                            </div>
                            <span className="text-sm font-bold text-white block">{alarm.camName}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* ==================================================================== */}
        {/* CENTER CANVAS: VIDEO RENDERING ENGINE */}
        {/* ==================================================================== */}
        <div className="flex-1 bg-black border border-white/10 rounded-3xl relative overflow-hidden shadow-2xl flex flex-col">
            
            {/* GRID VIEW */}
            {canvasView === 'grid' && (
                <div className="absolute inset-0 p-4 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        {dynamicCameras.map(cam => (
                            <div 
                                key={cam.id} 
                                onDoubleClick={() => { setActiveCameraId(cam.id); setActiveCameraName(cam.name); setCanvasView('live'); }}
                                className="aspect-video bg-slate-900 border border-white/10 rounded-xl overflow-hidden relative cursor-pointer group"
                            >
                                <video src={generateStreamUrl(cam.id, 'preview')} autoPlay muted playsInline loop className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-0.5 rounded text-[10px] font-bold text-white">{cam.name}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* SINGLE CAM VIEW */}
            {canvasView === 'live' && activeCameraId && (
                <div className="absolute inset-0 flex flex-col">
                    <div className="flex-1 relative">
                        <video key={`live-${activeCameraId}-${dvrOffset}`} src={generateStreamUrl(activeCameraId, 'primary', dvrOffset)} autoPlay muted playsInline className="w-full h-full object-contain" />
                        <div className="absolute top-4 left-4 flex gap-2">
                            <span className={`px-3 py-1 rounded text-[10px] font-black tracking-widest backdrop-blur-md ${dvrOffset === 0 ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-amber-500/20 text-amber-400 border border-amber-500/50'}`}>
                                {dvrOffset === 0 ? '● LIVE' : `DVR (-${dvrOffset}s)`}
                            </span>
                            <span className="bg-black/60 border border-white/10 px-3 py-1 rounded text-white text-[10px] font-bold tracking-widest backdrop-blur-md">
                                {activeCameraName.toUpperCase()}
                            </span>
                        </div>
                    </div>
                    {/* DVR SCRUBBER */}
                    <div className="h-16 bg-slate-950 border-t border-white/10 flex items-center px-6 gap-4">
                        <button onClick={() => setDvrOffset(0)} className={`px-4 py-1.5 rounded text-[10px] font-black tracking-widest ${dvrOffset === 0 ? 'bg-red-600 text-white' : 'bg-white/5 text-slate-400'}`}>LIVE</button>
                        <button onClick={() => setDvrOffset(15)} className={`px-4 py-1.5 rounded text-[10px] font-black tracking-widest ${dvrOffset === 15 ? 'bg-amber-600 text-white' : 'bg-white/5 text-slate-400'}`}>-15s</button>
                        <button onClick={() => setDvrOffset(60)} className={`px-4 py-1.5 rounded text-[10px] font-black tracking-widest ${dvrOffset === 60 ? 'bg-amber-600 text-white' : 'bg-white/5 text-slate-400'}`}>-1m</button>
                        <button onClick={() => setDvrOffset(300)} className={`px-4 py-1.5 rounded text-[10px] font-black tracking-widest ${dvrOffset === 300 ? 'bg-amber-600 text-white' : 'bg-white/5 text-slate-400'}`}>-5m</button>
                    </div>
                </div>
            )}

            {/* INCIDENT VIEW (DUAL PANE) */}
            {canvasView === 'incident' && activeCameraId && (
                <div className="absolute inset-0 flex">
                    <div className="flex-1 border-r border-white/10 relative">
                        {/* DVR Playback Left */}
                        <video key={`incident-${activeCameraId}-${dvrOffset}`} src={generateStreamUrl(activeCameraId, 'primary', dvrOffset || 15)} autoPlay muted playsInline className="w-full h-full object-contain" />
                        <span className="absolute top-4 left-4 bg-amber-500/20 text-amber-400 border border-amber-500/50 px-3 py-1 rounded text-[10px] font-black tracking-widest backdrop-blur-md">
                            INCIDENT PLAYBACK
                        </span>
                    </div>
                    <div className="flex-1 relative">
                        {/* Live Feed Right */}
                        <video key={`live-${activeCameraId}`} src={generateStreamUrl(activeCameraId, 'primary', 0)} autoPlay muted playsInline className="w-full h-full object-contain" />
                        <span className="absolute top-4 left-4 bg-red-500/20 text-red-400 border border-red-500/50 px-3 py-1 rounded text-[10px] font-black tracking-widest backdrop-blur-md">
                            LIVE STATUS
                        </span>
                    </div>
                </div>
            )}

            {/* MAP VIEW */}
            {canvasView === 'map' && (
                <div className="absolute inset-0 bg-slate-900 flex items-center justify-center relative">
                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                    <h2 className="text-white/20 font-black text-4xl uppercase tracking-[1em] absolute">FLOORPLAN API PENDING</h2>
                    {/* Mock Map Pins */}
                    <div className="absolute top-[40%] left-[30%] w-4 h-4 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,1)] cursor-pointer hover:scale-150 transition-transform"></div>
                    <div className="absolute top-[60%] right-[40%] w-4 h-4 bg-red-500 rounded-full shadow-[0_0_15px_rgba(239,68,68,1)] animate-pulse cursor-pointer"></div>
                </div>
            )}

        </div>

        {/* ==================================================================== */}
        {/* RIGHT PANEL: SOPs, BRIVO DOORS, AND REPORTING */}
        {/* ==================================================================== */}
        <div className="w-80 shrink-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
            
            {/* BRIVO ACCESS CONTROL */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Access Control</h3>
                <div className="flex flex-col gap-2">
                    {MOCK_DOORS.map(door => (
                        <div key={door.id} className="bg-black/50 border border-white/5 p-3 rounded-xl flex justify-between items-center">
                            <div>
                                <span className="text-xs font-bold text-white block">{door.name}</span>
                                <span className={`text-[9px] font-black uppercase tracking-widest ${door.status === 'Locked' ? 'text-slate-500' : 'text-emerald-400'}`}>{door.status}</span>
                            </div>
                            <button 
                                onClick={() => handleUnlockDoor(door.id, door.name)}
                                className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black px-3 py-1.5 rounded-lg transition-all shadow-[0_0_10px_rgba(37,99,235,0.3)]"
                            >
                                UNLOCK
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* STANDARD OPERATING PROCEDURES */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md flex-1">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Active SOP</h3>
                <div className="flex flex-col gap-2 mb-6">
                    {MOCK_SOPS.map((sop, i) => (
                        <label key={i} className="flex items-start gap-3 cursor-pointer group">
                            <input type="checkbox" className="mt-1 accent-emerald-500" />
                            <span className="text-xs text-slate-300 group-hover:text-white transition-colors leading-snug">{sop}</span>
                        </label>
                    ))}
                </div>

                <button 
                    onClick={handleFlagEvent}
                    className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-3 rounded-xl text-xs tracking-widest shadow-[0_0_15px_rgba(220,38,38,0.4)] transition-all flex items-center justify-center gap-2"
                >
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                    FLAG INCIDENT TO DB
                </button>
            </div>

        </div>
      </div>
    </div>
  );
}
