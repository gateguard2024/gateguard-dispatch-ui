"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase"; // <-- Bringing in our new CNS (Central Nervous System)

// ============================================================================
// STABLE HLS PLAYER (Direct Cluster / Zero Handshake)
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
// MAIN SOC INTERFACE (Now Supabase-Powered)
// ============================================================================
export default function AlarmsPage() {
  const [activeToken, setActiveToken] = useState<string | null>(null);
  
  // Real Data States
  const [alarms, setAlarms] = useState<any[]>([]);
  const [processingAlarm, setProcessingAlarm] = useState<any | null>(null);
  const [siteCameras, setSiteCameras] = useState<any[]>([]);
  
  // UI States
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [centerTab, setCenterTab] = useState<'cameras' | 'history' | 'notes'>('cameras');
  const [operatorNotes, setOperatorNotes] = useState("");
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 1. Initialization (Token & Audio)
  useEffect(() => {
    // Note: We use Marbella as the default token for now
    const token = localStorage.getItem(`een_token_Pegasus Properties - Marbella Place`);
    if (token) setActiveToken(token);
    
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audioRef.current.loop = true;
  }, []);

  // 2. Fetch Initial Alarms & Listen for New Ones (The Magic)
  useEffect(() => {
    const fetchAlarms = async () => {
      const { data, error } = await supabase
        .from('alarms')
        .select(`
          id, priority, event_type, status, created_at,
          sites ( id, name ),
          cameras ( id, name, een_esn )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) console.error("Error fetching alarms:", error);
      else setAlarms(data || []);
    };

    fetchAlarms();

    // Subscribe to REALTIME Inserts
    const subscription = supabase
      .channel('public:alarms')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alarms' }, payload => {
        // If anything changes in the alarms table, just refetch the fresh list
        fetchAlarms();
      })
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, []);

  // 3. Audio Beep Logic (Only beeps if there are pending alarms and you aren't processing one)
  const unacknowledgedCount = alarms.length;
  useEffect(() => {
    if (audioEnabled && audioRef.current) {
      if (unacknowledgedCount > 0 && !processingAlarm) {
        audioRef.current.play().catch(() => console.log("Audio blocked by browser"));
      } else {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, [unacknowledgedCount, processingAlarm, audioEnabled]);

  // 4. Operator Actions
  const handleProcessAlarm = async (alarm: any) => {
    setAudioEnabled(true); 
    setProcessingAlarm(alarm);
    
    // Immediately fetch the other cameras for this specific site to populate the bottom tab
    const { data } = await supabase
      .from('cameras')
      .select('*')
      .eq('site_id', alarm.sites.id);
    
    setSiteCameras(data || []);
  };

  const handleResolveAndDismiss = async () => {
    if (!processingAlarm) return;

    // 1. Update the alarm status in Supabase so it clears from the queue
    await supabase
      .from('alarms')
      .update({ status: 'resolved' })
      .eq('id', processingAlarm.id);

    // 2. (Optional) Log to audit_logs table
    await supabase
      .from('audit_logs')
      .insert({
        alarm_id: processingAlarm.id,
        operator_id: 'operator-1', // Will be Clerk ID later
        action_taken: 'Resolved Alarm',
        notes: operatorNotes || 'No notes provided.'
      });

    // Reset UI
    setProcessingAlarm(null);
    setOperatorNotes("");
  };

  const isFlashing = unacknowledgedCount > 0 && !processingAlarm;

  return (
    <div className="w-full h-full flex flex-col p-4 bg-[#030406] text-white overflow-hidden font-sans">
      
      {/* 🚀 HEADER */}
      <div className={`flex justify-between items-center mb-4 border rounded-2xl p-4 backdrop-blur-md transition-all duration-500 ${isFlashing ? 'bg-red-950/40 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]' : 'bg-[#0a0c10] border-white/5 shadow-2xl'}`}>
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-black tracking-tighter">DISPATCH STATION</h1>
          {!audioEnabled && (
             <button onClick={() => setAudioEnabled(true)} className="bg-indigo-600 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest animate-pulse shadow-lg shadow-indigo-900/40">
               Go On Duty (Enable Audio)
             </button>
          )}
        </div>

        <div className="flex gap-4">
            <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Alarms</span>
                <span className={`text-xl font-black ${unacknowledgedCount > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{unacknowledgedCount}</span>
            </div>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        
        {/* 🚨 LEFT: LIVE ALARM QUEUE */}
        <div className={`w-[350px] border rounded-[2rem] p-4 flex flex-col shadow-xl transition-all duration-500 ${isFlashing ? 'bg-red-950/20 border-red-500/50' : 'bg-[#0a0c10] border-white/5'}`}>
          <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest text-center border-b border-white/5 pb-2">Pending Events</h3>
          
          <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 pr-1">
            {alarms.length === 0 && (
                <div className="text-center text-slate-600 text-xs font-bold uppercase tracking-widest mt-10">Queue Empty</div>
            )}
            
            {alarms.map((alarm) => (
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
                  <span className="text-[9px] text-slate-400 font-mono">
                      {new Date(alarm.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                  </span>
                </div>
                <span className="text-sm font-bold text-white block truncate">{alarm.sites?.name || 'Unknown Site'}</span>
                <span className="text-xs text-slate-400 block truncate mb-3">{alarm.event_type} - {alarm.cameras?.name}</span>
                
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
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/5">
                      <span className="text-2xl">🛡️</span>
                  </div>
                  <span className="text-slate-500 text-[11px] font-black tracking-[0.5em] uppercase">Awaiting Operator Action</span>
              </div>
          ) : (
            <div className="flex-1 flex flex-col h-full animate-in fade-in zoom-in-95 duration-300">
                {/* TOP: Dual Video Players */}
                <div className="h-[55%] flex border-b border-white/10">
                    <div className="flex-1 relative border-r border-white/10 bg-slate-950 p-2">
                        {/* Pre-Alarm Substream (Fast Load) */}
                        <SmartVideoPlayer 
                          siteId={processingAlarm.sites?.id} 
                          cameraEsn={processingAlarm.cameras?.een_esn} 
                          streamType="preview" 
                        />
                        <span className="absolute top-4 left-4 bg-amber-600 px-3 py-1 rounded-lg text-[9px] font-black shadow-xl uppercase tracking-widest border border-amber-400/50 z-10 pointer-events-none">Pre-Alarm Clip</span>
                    </div>
                    <div className="flex-1 relative bg-slate-950 p-2">
                        {/* Live Main Stream (High Res) */}
                        <SmartVideoPlayer 
                          siteId={processingAlarm.sites?.id} 
                          cameraEsn={processingAlarm.cameras?.een_esn} 
                          streamType="main" 
                        />
                        <span className="absolute top-4 left-4 bg-red-600 px-3 py-1 rounded-lg text-[9px] font-black shadow-xl uppercase tracking-widest border border-red-400/50 z-10 pointer-events-none">Live Status</span>
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
                                className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${centerTab === tab.id ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'border-transparent text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    
                    <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
                        {centerTab === 'cameras' && (
                            <div className="grid grid-cols-4 gap-3">
                                {siteCameras.map(cam => (
                                    <div key={cam.id} className="bg-black border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 transition-all group shadow-md">
                                        <span className="text-xl mb-2 opacity-50 group-hover:opacity-100 transition-all">📹</span>
                                        <span className="text-[10px] font-bold text-center leading-tight text-slate-300 group-hover:text-white">{cam.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {centerTab === 'history' && (
                            <div className="text-[10px] font-mono text-slate-500 text-center mt-10 uppercase tracking-widest">History Log Ready for Data</div>
                        )}
                        {centerTab === 'notes' && (
                            <textarea 
                                value={operatorNotes}
                                onChange={(e) => setOperatorNotes(e.target.value)}
                                className="w-full h-full bg-black border border-white/10 rounded-xl p-4 text-sm font-mono text-white resize-none focus:outline-none focus:border-indigo-500 transition-all shadow-inner" 
                                placeholder="Enter incident notes here to attach to audit log..."
                            />
                        )}
                    </div>
                </div>
            </div>
          )}
      </div>

      {/* ⚡ RIGHT: ACTION CENTER */}
        <div className="w-[320px] shrink-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
          
          {/* HARDWARE OVERRIDE */}
          <div className={`bg-[#0a0c10] border rounded-[2.5rem] p-6 shadow-xl transition-all duration-300 ${processingAlarm ? 'border-indigo-500/30' : 'border-white/5 opacity-50 pointer-events-none'}`}>
              <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest border-b border-white/5 pb-2">Hardware Override</h3>
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

          {/* CONTACTS */}
          <div className={`bg-[#0a0c10] border rounded-[2.5rem] p-6 shadow-xl transition-all duration-300 ${processingAlarm ? 'border-white/5' : 'border-white/5 opacity-50 pointer-events-none'}`}>
              <h3 className="text-[10px] font-black text-slate-500 uppercase mb-3 tracking-widest">Emergency Contacts</h3>
              <div className="space-y-2">
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center group hover:bg-white/10 hover:border-white/10 transition-all cursor-pointer">
                      <div>
                          <span className="text-[11px] font-bold block text-white">Local Police Dept</span>
                          <span className="text-[9px] text-slate-400 font-mono block">800-555-0199</span>
                      </div>
                      <span className="text-[10px] font-black text-indigo-400 opacity-0 group-hover:opacity-100 transition-all">CALL</span>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center group hover:bg-white/10 hover:border-white/10 transition-all cursor-pointer">
                      <div>
                          <span className="text-[11px] font-bold block text-white">Courtesy Officer</span>
                          <span className="text-[9px] text-slate-400 font-mono block">Mitul Patel</span>
                      </div>
                      <span className="text-[10px] font-black text-indigo-400 opacity-0 group-hover:opacity-100 transition-all">CALL</span>
                  </div>
              </div>
          </div>

          {/* PROTOCOL / DISMISS */}
          <div className={`bg-gradient-to-br from-[#0a0c10] to-[#030406] border rounded-[2.5rem] p-6 shadow-2xl flex-1 flex flex-col transition-all duration-300 ${processingAlarm ? 'border-emerald-500/20' : 'border-white/5 opacity-50 pointer-events-none'}`}>
              <h3 className="text-[10px] font-black text-indigo-400 uppercase mb-4 tracking-widest">Clearance Protocol</h3>
              <div className="space-y-4 opacity-60 mb-6 flex-1">
                {["Visual Verification", "Verify Credentials", "Announce via Audio"].map(t => (
                  <div key={t} className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-white/20 rounded-lg bg-black/40"></div>
                    <span className="text-[11px] font-bold text-slate-300">{t}</span>
                  </div>
                ))}
              </div>
              <button 
                  onClick={handleResolveAndDismiss} 
                  className="w-full bg-emerald-600 hover:bg-emerald-500 py-4 rounded-2xl text-[10px] font-black transition-all shadow-lg shadow-emerald-900/40 tracking-widest text-white active:scale-95"
              >
                  RESOLVE & DISMISS
              </button>
          </div>

        </div>
      </div>
    </div>
  );
}
