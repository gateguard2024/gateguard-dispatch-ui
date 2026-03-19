"use client";

import React, { useState } from "react";

export default function BaselineAlarmsPage() {
  const [activeEvent, setActiveEvent] = useState(1); // 1 = Standard Gate Motion, 2 = Concierge Call
  const [canvasView, setCanvasView] = useState("live"); // 'live' or 'map'
  const [rightPanelTab, setRightPanelTab] = useState("action");
  const [idCaptured, setIdCaptured] = useState(false);

  return (
    <div className="w-full h-full flex gap-6 p-6 relative bg-[#05070a]">
      
      {/* LEFT: TRIAGE QUEUE */}
      <div className="w-80 flex flex-col gap-4 z-10 shrink-0">
        <div className="flex justify-between items-center bg-white/5 px-4 py-3 rounded-xl border border-white/10 backdrop-blur-md">
          <span className="text-xs font-black tracking-widest text-emerald-400">INCOMING QUEUE</span>
          <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-1 rounded-full font-bold border border-emerald-500/30">2 LIVE</span>
        </div>
        
        <div className="flex flex-col gap-3">
          {/* Active Event - [P3] Standard Gate Alarm */}
          <div 
            onClick={() => { setActiveEvent(1); setCanvasView("live"); }}
            className={`rounded-2xl p-4 cursor-pointer relative overflow-hidden transition-all ${activeEvent === 1 ? 'bg-gradient-to-br from-slate-800 to-slate-900 border border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
          >
            {activeEvent === 1 && <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>}
            <div className="flex justify-between items-start mb-2">
              <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${activeEvent === 1 ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 border border-slate-700'}`}>P3 SECURITY</span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold animate-pulse">00:12s</span>
            </div>
            <h3 className={`font-bold text-lg ${activeEvent === 1 ? 'text-white' : 'text-slate-300'}`}>Elevate Greene</h3>
            <p className="text-slate-400 text-xs mt-1">Main Gate • Motion Detected</p>
          </div>

          {/* Queued Event - [P2] Concierge Call */}
          <div 
            onClick={() => { setActiveEvent(2); setCanvasView("live"); }}
            className={`rounded-2xl p-4 cursor-pointer relative overflow-hidden transition-all ${activeEvent === 2 ? 'bg-gradient-to-br from-slate-800 to-slate-900 border border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.15)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
          >
            {activeEvent === 2 && <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>}
            <div className="flex justify-between items-start mb-2">
              <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${activeEvent === 2 ? 'bg-amber-500/20 text-amber-400' : 'text-slate-500 border border-slate-700'}`}>P2 CONCIERGE</span>
              <span className="text-[10px] font-mono text-slate-400">01:05s</span>
            </div>
            <h3 className={`font-bold text-lg ${activeEvent === 2 ? 'text-white' : 'text-slate-300'}`}>Avana Chase</h3>
            <p className="text-slate-400 text-xs mt-1">Door Station • Visitor Call</p>
          </div>
        </div>
      </div>

      {/* CENTER: THE IMMERSIVE CANVAS */}
      <div className="flex-1 relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-black flex flex-col group">
        
        {/* Canvas Header */}
        <div className="absolute top-0 w-full p-6 bg-gradient-to-b from-black/90 via-black/50 to-transparent flex justify-between items-start z-30 pointer-events-none">
          <div className="pointer-events-auto flex flex-col gap-3">
            <h1 className="text-3xl font-black text-white tracking-wide drop-shadow-lg flex items-center">
              <span className={`w-3 h-3 rounded-full mr-4 shadow-[0_0_15px_currentColor] ${activeEvent === 1 ? 'bg-emerald-500 text-emerald-500' : 'bg-amber-500 text-amber-500'}`}></span>
              {activeEvent === 1 ? "Elevate Greene" : "Avana Chase"}
            </h1>
            <div className="flex gap-2 opacity-80 hover:opacity-100 transition-opacity">
               <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg text-[10px] font-medium text-slate-300">
                 <span>📍</span> {activeEvent === 1 ? "123 Main St, Sandy Springs" : "456 Avana Way, Atlanta"}
               </div>
               <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg text-[10px] font-medium text-slate-300">
                 <span>📞</span> Desk: (555) 123-4567
               </div>
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
            
            {/* Standard Event Live Feed */}
            {activeEvent === 1 ? (
              <>
                <img src="https://images.unsplash.com/photo-1621252179027-94459d278660?q=80&w=2070&auto=format&fit=crop" alt="Live Feed" className="absolute inset-0 w-full h-full object-cover opacity-80" />
                
                {/* Pre-Alarm PiP */}
                <div className="absolute bottom-6 left-6 w-80 aspect-video bg-black rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)] border border-white/20 z-20 group/pip hover:scale-105 transition-transform cursor-pointer origin-bottom-left">
                  <div className="absolute top-2 left-2 bg-rose-500/90 backdrop-blur px-2 py-0.5 rounded text-[9px] font-black text-white uppercase tracking-wider z-10 shadow-md">10s Pre-Alarm</div>
                  <img src="https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=2070&auto=format&fit=crop" alt="Pre-Alarm" className="w-full h-full object-cover opacity-90" />
                  <div className="absolute bottom-0 w-full h-1 bg-white/20"><div className="w-2/3 h-full bg-rose-500"></div></div>
                </div>

                {/* Camera Carousel */}
                <div className="absolute bottom-6 right-6 flex gap-3 z-20 overflow-x-auto max-w-md snap-x p-1">
                   {["Main Gate", "Exit Gate", "Leasing Center", "Pool"].map((cam, i) => (
                     <div key={cam} className={`shrink-0 w-32 aspect-video bg-black/80 backdrop-blur-md border ${i===0 ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'border-white/20 hover:border-white/50'} rounded-xl cursor-pointer flex flex-col justify-end p-2 snap-center relative overflow-hidden group/cam`}>
                        {i === 0 && <img src="https://images.unsplash.com/photo-1621252179027-94459d278660?w=400&q=80" className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover/cam:opacity-60 transition-opacity" />}
                        <span className="text-[10px] font-bold text-white drop-shadow-md relative z-10 bg-black/50 px-1.5 py-0.5 rounded">{cam}</span>
                     </div>
                   ))}
                </div>
              </>
            ) : (
              /* Concierge Event Live Feed */
              <>
                <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=2000&auto=format&fit=crop" alt="Intercom Feed" className="absolute inset-0 w-full h-full object-cover opacity-80" />
                <div className="absolute inset-0 bg-amber-900/10 mix-blend-color pointer-events-none"></div>
                <div className="absolute top-6 right-6 flex items-center gap-3 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 z-30">
                   <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                   <span className="text-xs font-bold text-white tracking-widest">TWILIO AUDIO ACTIVE</span>
                </div>
                {/* ID Capture Viewfinder */}
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-48 border-2 transition-all duration-300 flex flex-col items-center justify-end p-4 shadow-[0_0_50px_rgba(0,0,0,0.5)] z-20 ${idCaptured ? 'border-emerald-500 bg-emerald-500/10' : 'border-amber-500/50 border-dashed bg-black/20'}`}></div>
              </>
            )}
          </div>
        ) : (
          /* TACTICAL MAP RENDERER */
          <div className="flex-1 w-full h-full relative bg-[#17263c] overflow-hidden">
             {/* Realistic Google Maps Dark Mode Placeholder */}
             <img 
               src="https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=2074&auto=format&fit=crop" 
               alt="Tactical Map" 
               className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-screen grayscale"
             />
             <div className="absolute inset-0 bg-blue-900/20 mix-blend-multiply pointer-events-none"></div>
             
             {/* Flashing Incident Node on Map */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 group/node cursor-pointer z-20">
                <div className={`absolute -inset-8 rounded-full animate-ping ${activeEvent === 1 ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}></div>
                <div className={`relative w-6 h-6 rounded-full border-[3px] border-white flex items-center justify-center shadow-[0_0_20px_currentColor] ${activeEvent === 1 ? 'bg-emerald-500 text-emerald-500' : 'bg-amber-500 text-amber-500'}`}>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                
                {/* Map Preview Hover Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-56 aspect-video bg-black border border-white/20 rounded-xl opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none flex flex-col overflow-hidden shadow-2xl z-30">
                   <div className={`text-[10px] font-black text-white w-full text-center py-1 tracking-widest ${activeEvent === 1 ? 'bg-emerald-600' : 'bg-amber-600'}`}>
                     {activeEvent === 1 ? 'MOTION DETECTED' : 'CONCIERGE CALL'}
                   </div>
                   <img src={activeEvent === 1 ? "https://images.unsplash.com/photo-1621252179027-94459d278660?w=400" : "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400"} className="w-full flex-1 object-cover" />
                </div>
             </div>
          </div>
        )}
      </div>

      {/* RIGHT: DYNAMIC ACTION DRAWER */}
      <div className="w-[360px] flex flex-col gap-4 z-10 shrink-0">
        
        {/* Tab Selection */}
        <div className="flex bg-white/5 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl shrink-0">
          <button onClick={() => setRightPanelTab("action")} className={`flex-1 text-[10px] font-black uppercase py-2.5 rounded-xl transition-all tracking-wider ${rightPanelTab === "action" ? "bg-white/20 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}>Action & SOP</button>
          <button onClick={() => setRightPanelTab("controls")} className={`flex-1 text-[10px] font-black uppercase py-2.5 rounded-xl transition-all tracking-wider ${rightPanelTab === "controls" ? "bg-white/20 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}>Controls</button>
          <button onClick={() => setRightPanelTab("notes")} className={`flex-1 text-[10px] font-black uppercase py-2.5 rounded-xl transition-all tracking-wider ${rightPanelTab === "notes" ? "bg-white/20 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}>Site Notes</button>
        </div>

        <div className="flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 flex flex-col shadow-2xl relative overflow-hidden min-h-0">
          
          {/* STANDARD GATE ALARM PANEL */}
          {activeEvent === 1 && rightPanelTab === "action" && (
            <div className="flex flex-col h-full">
              <h2 className="text-[10px] font-black text-slate-500 tracking-[0.2em] mb-4">STANDARD SOP</h2>
              <div className="space-y-3 mb-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                 <label className="flex items-start space-x-3 cursor-pointer group">
                   <input type="checkbox" className="mt-1 w-4 h-4 rounded border-slate-600 bg-black/50 text-emerald-500" />
                   <span className="text-sm text-slate-300 group-hover:text-white transition-colors">Verify vehicle is marked LEO or Emergency.</span>
                 </label>
                 <label className="flex items-start space-x-3 cursor-pointer group">
                   <input type="checkbox" className="mt-1 w-4 h-4 rounded border-slate-600 bg-black/50 text-emerald-500" />
                   <span className="text-sm text-slate-300 group-hover:text-white transition-colors">If emergency, click UNLOCK MAIN GATE.</span>
                 </label>
              </div>

              <div className="shrink-0 pt-4 border-t border-white/10">
                <h2 className="text-[10px] font-black text-slate-500 tracking-[0.2em] mb-3">QUICK RESOLVE</h2>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button className="bg-slate-800 hover:bg-slate-700 text-[10px] text-white font-bold py-2.5 rounded-xl transition-all border border-slate-700">NOTHING SEEN</button>
                  <button className="bg-emerald-900/40 hover:bg-emerald-900/60 text-[10px] text-emerald-400 font-bold py-2.5 rounded-xl transition-all border border-emerald-500/30">AUTH GUEST / LEO</button>
                  <button className="bg-slate-800 hover:bg-slate-700 text-[10px] text-white font-bold py-2.5 rounded-xl transition-all border border-slate-700">FALSE ALARM</button>
                  <button className="bg-rose-900/40 hover:bg-rose-900/60 text-[10px] text-rose-400 font-bold py-2.5 rounded-xl transition-all border border-rose-500/30">DISPATCH LEO</button>
                </div>
                <input type="text" placeholder="Custom resolution notes..." className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none mb-3" />
                <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3.5 rounded-xl transition-all text-xs tracking-widest shadow-lg">
                  LOG TO BRIVO & CLOSE
                </button>
              </div>
            </div>
          )}

          {/* CONCIERGE PANEL */}
          {activeEvent === 2 && rightPanelTab === "action" && (
            <div className="flex flex-col h-full">
              <h2 className="text-[10px] font-black text-amber-500 tracking-[0.2em] mb-4">CONCIERGE WORKFLOW</h2>
              <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl mb-4">
                <p className="text-xs text-amber-200 font-medium italic">"Welcome to Avana Chase. Please state the resident you are visiting and hold your ID to the camera."</p>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-auto">
                <button onClick={() => setIdCaptured(true)} className={`text-[10px] font-bold py-3 rounded-xl transition-all border ${idCaptured ? 'bg-emerald-900/40 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-white border-slate-700'}`}>
                  {idCaptured ? '✓ ID LOGGED' : '📸 CAPTURE ID'}
                </button>
                <button className="bg-slate-800 text-white text-[10px] font-bold py-3 rounded-xl border border-slate-700">CALL RESIDENT</button>
              </div>
              
              <div className="shrink-0 pt-4 border-t border-white/10 mt-6">
                 <button className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black py-3.5 rounded-xl transition-all text-xs tracking-widest shadow-lg mb-3">
                  🔓 UNLOCK DOOR STATION
                </button>
                <button className="w-full bg-slate-700 hover:bg-slate-600 text-white font-black py-3.5 rounded-xl transition-all text-xs tracking-widest shadow-lg">
                  DENY & CLOSE
                </button>
              </div>
            </div>
          )}

          {rightPanelTab !== "action" && (
             <div className="flex h-full items-center justify-center text-slate-500 text-xs text-center px-4">
                Controls and Site Notes modules active in background.
             </div>
          )}
        </div>
      </div>

    </div>
  );
}
