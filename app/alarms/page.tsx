"use client";

import React, { useState } from "react";

export default function AlarmsPage() {
  const [canvasView, setCanvasView] = useState("live");
  const [rightPanelTab, setRightPanelTab] = useState("action");
  const [leftPanelTab, setLeftPanelTab] = useState("current");

  // Concierge Workflow State
  const [idCaptured, setIdCaptured] = useState(false);
  const [callingResident, setCallingResident] = useState(false);

  return (
    <div className="w-full h-full flex gap-6 p-6 relative">
      
      {/* LEFT: TRIAGE QUEUE */}
      <div className="w-80 flex flex-col gap-4 z-10 shrink-0">
        
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 backdrop-blur-md">
          <button onClick={() => setLeftPanelTab("current")} className={`flex-1 text-[10px] font-black tracking-widest py-2.5 rounded-lg transition-all ${leftPanelTab === "current" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-slate-400 hover:text-white"}`}>
            CURRENT (3)
          </button>
          <button onClick={() => setLeftPanelTab("past")} className={`flex-1 text-[10px] font-black tracking-widest py-2.5 rounded-lg transition-all ${leftPanelTab === "past" ? "bg-white/20 text-white border border-white/10" : "text-slate-400 hover:text-white"}`}>
            PAST EVENTS
          </button>
        </div>
        
        {leftPanelTab === "current" && (
          <div className="flex flex-col gap-3">
            
            {/* ACTIVE ALARM: [P2] Concierge Call */}
            <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-amber-500/50 rounded-2xl p-4 shadow-[0_0_30px_rgba(245,158,11,0.15)] cursor-pointer relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,1)]"></div>
              <div className="flex justify-between items-start mb-2">
                <div className="flex gap-2 items-center">
                  <span className="text-[10px] font-black bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded uppercase tracking-widest">P2 CONCIERGE</span>
                  <span className="text-[9px] font-bold text-white bg-black/50 px-2 py-0.5 rounded border border-white/10 animate-pulse">ACTIVE</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">00:14s</span>
              </div>
              <h3 className="text-white font-bold text-lg group-hover:text-amber-400 transition-colors">Elevate Greene</h3>
              <p className="text-slate-400 text-xs mt-1">Brivo Door Station • Visitor Call</p>
            </div>

            {/* WAITING ALARM: [P1] Critical (Pulsing Heavily) */}
            <div className="bg-white/5 backdrop-blur-md border border-rose-500/40 rounded-2xl p-4 hover:bg-white/10 transition-colors cursor-pointer relative overflow-hidden shadow-[0_0_15px_rgba(244,63,94,0.1)]">
              <div className="absolute inset-0 border-2 border-rose-500/30 rounded-2xl animate-pulse pointer-events-none"></div>
              <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
              <div className="flex justify-between items-start mb-2">
                 <span className="text-[10px] font-black bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded uppercase tracking-widest animate-pulse">P1 CRITICAL</span>
                <span className="text-[10px] font-mono text-rose-400 font-bold">00:05s</span>
              </div>
              <h3 className="text-slate-200 font-bold text-lg">Avana Chase</h3>
              <p className="text-rose-400 text-xs mt-1 font-bold">Gate Camera • Weapon Detected</p>
            </div>

            {/* WAITING ALARM: [P3] Security (Pulsing Softly) */}
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors cursor-pointer relative">
               <div className="absolute inset-0 border border-orange-500/20 rounded-2xl animate-pulse pointer-events-none"></div>
              <div className="flex justify-between items-start mb-2">
                 <span className="text-[10px] font-black bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded uppercase tracking-widest">P3 SECURITY</span>
                <span className="text-[10px] font-mono text-slate-400">01:45s</span>
              </div>
              <h3 className="text-slate-300 font-bold text-lg">Dunwoody Village</h3>
              <p className="text-slate-500 text-xs mt-1">Exit Gate • Forced Open</p>
            </div>

          </div>
        )}
      </div>

      {/* CENTER: CONCIERGE CANVAS */}
      <div className="flex-1 relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-black flex flex-col group">
        
        {/* Canvas Header */}
        <div className="absolute top-0 w-full p-6 bg-gradient-to-b from-black/90 via-black/50 to-transparent flex justify-between items-start z-30 pointer-events-none">
          <div className="pointer-events-auto flex flex-col gap-3">
            <h1 className="text-3xl font-black text-white tracking-wide drop-shadow-lg flex items-center">
              <span className="w-3 h-3 bg-amber-500 rounded-full mr-4 shadow-[0_0_15px_rgba(245,158,11,1)]"></span>
              Elevate Greene
            </h1>
            <div className="flex gap-2 opacity-80 hover:opacity-100 transition-opacity">
               <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg text-[10px] font-medium text-slate-300">
                 <span>📍</span> 123 Main St, Sandy Springs, GA
               </div>
            </div>
          </div>
        </div>

        {/* LIVE CANVAS WITH ID VIEWFINDER */}
        <div className="flex-1 w-full h-full relative flex items-center justify-center bg-[#0a0f18] overflow-hidden">
          <img 
            src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=2000&auto=format&fit=crop" 
            alt="Intercom Feed" 
            className="absolute inset-0 w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-amber-900/10 mix-blend-color"></div>

          {/* Picture ID Verification Overlay */}
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-80 border-2 transition-all duration-300 flex flex-col items-center justify-end p-4 shadow-[0_0_50px_rgba(0,0,0,0.5)] ${idCaptured ? 'border-emerald-500 bg-emerald-500/10' : 'border-amber-500/50 border-dashed bg-black/20'}`}>
             {!idCaptured ? (
               <div className="text-center bg-black/60 backdrop-blur px-3 py-1.5 rounded-lg mb-auto mt-4 border border-white/10">
                 <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block">Awaiting ID</span>
                 <span className="text-[8px] text-slate-300">Align ID in frame</span>
               </div>
             ) : (
               <div className="text-center bg-emerald-500/90 backdrop-blur px-3 py-1.5 rounded-lg mb-auto mt-4 border border-white/10 shadow-lg">
                 <span className="text-[10px] font-bold text-white uppercase tracking-widest block">ID Captured</span>
                 <span className="text-[8px] text-emerald-100">Saved to Audit Log</span>
               </div>
             )}
             
             {/* Reticle corners */}
             <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-amber-500"></div>
             <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-amber-500"></div>
             <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-amber-500"></div>
             <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-amber-500"></div>
          </div>

          {/* SIP Audio Waveform Graphic */}
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
             <span className="text-xs font-bold text-amber-400 tracking-widest mr-2">LIVE AUDIO</span>
             {[1,2,3,4,5,6].map(i => (
               <div key={i} className={`w-1 bg-amber-400 rounded-full animate-pulse`} style={{ height: `${Math.max(8, Math.random() * 24)}px`, animationDelay: `${i * 0.1}s` }}></div>
             ))}
          </div>

          {/* Pre-Alarm PiP */}
          <div className="absolute bottom-6 left-6 w-80 aspect-video bg-black rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)] border border-white/20 z-20 group/pip hover:scale-105 transition-transform cursor-pointer origin-bottom-left">
            <div className="absolute top-2 left-2 bg-slate-800/90 backdrop-blur px-2 py-0.5 rounded text-[9px] font-black text-white uppercase tracking-wider z-10 shadow-md">Approach Clip</div>
            <img 
              src="https://images.unsplash.com/photo-1494976388531-d1058494cdd8?q=80&w=2070&auto=format&fit=crop" 
              alt="Approach" 
              className="w-full h-full object-cover opacity-70"
            />
          </div>
        </div>
      </div>

      {/* RIGHT: CONCIERGE ACTION DRAWER */}
      <div className="w-[360px] flex flex-col gap-4 z-10 shrink-0">
        
        {/* CONCIERGE COPILOT */}
        <div className="bg-gradient-to-br from-amber-900/40 to-orange-900/40 backdrop-blur-xl border border-amber-500/40 rounded-3xl p-5 shadow-xl relative overflow-hidden shrink-0">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/20 blur-3xl rounded-full pointer-events-none"></div>
          <div className="flex items-center space-x-2 mb-3 relative z-10">
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            <h3 className="text-[10px] font-black text-amber-300 uppercase tracking-widest">Concierge Active</h3>
          </div>
          <p className="text-xs text-amber-100/90 font-medium leading-relaxed relative z-10">
            Visitor requests access to <span className="text-white font-bold bg-amber-500/40 px-1.5 py-0.5 rounded border border-amber-400/50 mx-1">Unit 402</span>. Verify ID and contact resident before granting Brivo access.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-white/5 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl shrink-0">
          <button onClick={() => setRightPanelTab("action")} className={`flex-1 text-[10px] font-black uppercase py-2.5 rounded-xl transition-all tracking-wider ${rightPanelTab === "action" ? "bg-white/20 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}>Workflow</button>
          <button onClick={() => setRightPanelTab("controls")} className={`flex-1 text-[10px] font-black uppercase py-2.5 rounded-xl transition-all tracking-wider ${rightPanelTab === "controls" ? "bg-white/20 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}>Hardware</button>
          <button onClick={() => setRightPanelTab("notes")} className={`flex-1 text-[10px] font-black uppercase py-2.5 rounded-xl transition-all tracking-wider ${rightPanelTab === "notes" ? "bg-white/20 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}>Site Notes</button>
        </div>

        {/* RIGHT PANEL CONTENT AREA */}
        <div className="flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 flex flex-col shadow-2xl relative overflow-hidden min-h-0">
          
          {rightPanelTab === "action" && (
            <div className="flex flex-col h-full">
              
              {/* Resident Directory Integration */}
              <h2 className="text-[10px] font-black text-slate-500 tracking-[0.2em] mb-2">DIRECTORY: UNIT 402</h2>
              <div className="bg-black/30 border border-white/5 rounded-xl p-3 mb-5 flex justify-between items-center">
                 <div>
                   <div className="text-sm font-bold text-white">Sarah Jenkins</div>
                   <div className="text-[10px] text-slate-400 font-mono">Mobile: (555) 019-8372</div>
                 </div>
                 <button 
                   onClick={() => setCallingResident(!callingResident)}
                   className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${callingResident ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'}`}
                 >
                   {callingResident ? 'END CALL' : 'CALL TENANT'}
                 </button>
              </div>

              {/* Concierge Action Buttons */}
              <h2 className="text-[10px] font-black text-slate-500 tracking-[0.2em] mb-3">CONCIERGE ACTIONS</h2>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button 
                  onClick={() => setIdCaptured(true)}
                  className={`text-[10px] font-bold py-3 rounded-xl transition-all border ${idCaptured ? 'bg-emerald-900/40 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700'}`}
                >
                  {idCaptured ? '✓ ID CAPTURED' : '📸 CAPTURE ID'}
                </button>
                <button className="bg-slate-800 hover:bg-slate-700 text-[10px] text-white font-bold py-3 rounded-xl transition-all border border-slate-700">🎙️ 2-WAY AUDIO</button>
                <button className="col-span-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-3.5 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all text-xs tracking-widest border border-emerald-400/50">
                  UNLOCK BRIVO DOOR
                </button>
              </div>

              <div className="shrink-0 pt-4 border-t border-white/10 mt-auto">
                <input type="text" placeholder="Visitor name / Delivery company..." className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-amber-500/50 outline-none mb-3 placeholder:text-slate-500" />
                <button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black py-3.5 rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all text-xs tracking-widest">
                  LOG & CLOSE TICKET
                </button>
              </div>
            </div>
          )}

          {/* Fallbacks for Controls/Notes to keep demo focused */}
          {rightPanelTab !== "action" && (
             <div className="flex h-full items-center justify-center text-slate-500 text-xs text-center px-4">
                Switch back to 'Workflow' to complete the Concierge process.
             </div>
          )}

        </div>
      </div>

    </div>
  );
}
