"use client";

import React, { useState } from "react";

export default function BaselineAlarmsPage() {
  // Navigation & View State
  const [activeEvent, setActiveEvent] = useState(1); // 1 = Gate Motion, 2 = Concierge Call
  const [canvasView, setCanvasView] = useState("live"); // 'live' or 'map'
  const [rightPanelTab, setRightPanelTab] = useState("action"); // 'action', 'controls', 'notes'
  const [leftPanelTab, setLeftPanelTab] = useState("current"); // 'current' or 'past'

  // Concierge Workflow State
  const [idCaptured, setIdCaptured] = useState(false);
  const [workflowStep, setWorkflowStep] = useState("greeting");
  const [callingResident, setCallingResident] = useState(false);

  // Controls & Notes State
  const [customSnooze, setCustomSnooze] = useState("");
  const [newNote, setNewNote] = useState("");
  const [notes, setNotes] = useState([
    { id: 1, text: "Property manager on vacation until 3/25. Escalate to Assistant GM.", author: "System", type: "general" },
    { id: 2, text: "Main gate arm is sticking. Use 2-way audio to advise backing up.", author: "Admin", type: "warning" }
  ]);

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    setNotes([{ id: Date.now(), text: newNote, author: "RF (You)", type: "general" }, ...notes]);
    setNewNote("");
  };

  const clearNote = (id: number) => {
    setNotes(notes.filter(n => n.id !== id));
  };

  return (
    <div className="w-full h-full flex gap-6 p-6 relative bg-[#05070a]">
      
      {/* LEFT: TRIAGE QUEUE */}
      <div className="w-80 flex flex-col gap-4 z-10 shrink-0">
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 backdrop-blur-md">
          <button onClick={() => setLeftPanelTab("current")} className={`flex-1 text-[10px] font-black tracking-widest py-2.5 rounded-lg transition-all ${leftPanelTab === "current" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-slate-400 hover:text-white"}`}>
            CURRENT (2)
          </button>
          <button onClick={() => setLeftPanelTab("past")} className={`flex-1 text-[10px] font-black tracking-widest py-2.5 rounded-lg transition-all ${leftPanelTab === "past" ? "bg-white/20 text-white border border-white/10" : "text-slate-400 hover:text-white"}`}>
            PAST EVENTS
          </button>
        </div>
        
        {leftPanelTab === "current" && (
          <div className="flex flex-col gap-3">
            {/* Standard Event */}
            <div onClick={() => { setActiveEvent(1); setCanvasView("live"); }} className={`rounded-2xl p-4 cursor-pointer relative overflow-hidden transition-all ${activeEvent === 1 ? 'bg-gradient-to-br from-slate-800 to-slate-900 border border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
              {activeEvent === 1 && <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>}
              <div className="flex justify-between items-start mb-2">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${activeEvent === 1 ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 border border-slate-700'}`}>P3 SECURITY</span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold animate-pulse">00:12s</span>
              </div>
              <h3 className={`font-bold text-lg ${activeEvent === 1 ? 'text-white' : 'text-slate-300'}`}>Elevate Greene</h3>
              <p className="text-slate-400 text-xs mt-1">Main Gate • Motion Detected</p>
            </div>

            {/* Concierge Event */}
            <div onClick={() => { setActiveEvent(2); setCanvasView("live"); }} className={`rounded-2xl p-4 cursor-pointer relative overflow-hidden transition-all ${activeEvent === 2 ? 'bg-gradient-to-br from-slate-800 to-slate-900 border border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.15)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
              {activeEvent === 2 && <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>}
              <div className="flex justify-between items-start mb-2">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${activeEvent === 2 ? 'bg-amber-500/20 text-amber-400' : 'text-slate-500 border border-slate-700'}`}>P2 CONCIERGE</span>
                <span className="text-[10px] font-mono text-slate-400">01:05s</span>
              </div>
              <h3 className={`font-bold text-lg ${activeEvent === 2 ? 'text-white' : 'text-slate-300'}`}>Avana Chase</h3>
              <p className="text-slate-400 text-xs mt-1">Door Station • Visitor Call</p>
            </div>
          </div>
        )}

        {leftPanelTab === "past" && (
          <div className="flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar text-slate-400 text-sm text-center mt-10">
            Historical events populate here.
          </div>
        )}
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
            {activeEvent === 1 && (
              <>
                <img src="https://images.unsplash.com/photo-1621252179027-94459d278660?q=80&w=2070&auto=format&fit=crop" alt="Live Feed" className="absolute inset-0 w-full h-full object-cover opacity-80" />
                <div className="absolute bottom-6 left-6 w-80 aspect-video bg-black rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)] border border-white/20 z-20 group/pip hover:scale-105 transition-transform cursor-pointer origin-bottom-left">
                  <div className="absolute top-2 left-2 bg-rose-500/90 backdrop-blur px-2 py-0.5 rounded text-[9px] font-black text-white uppercase tracking-wider z-10 shadow-md">10s Pre-Alarm</div>
                  <img src="https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=2070&auto=format&fit=crop" alt="Pre-Alarm" className="w-full h-full object-cover opacity-90" />
                  <div className="absolute bottom-0 w-full h-1 bg-white/20"><div className="w-2/3 h-full bg-rose-500"></div></div>
                </div>
                <div className="absolute bottom-6 right-6 flex gap-3 z-20 overflow-x-auto max-w-md snap-x p-1">
                   {["Main Gate", "Exit Gate", "Leasing Center", "Pool"].map((cam, i) => (
                     <div key={cam} className={`shrink-0 w-32 aspect-video bg-black/80 backdrop-blur-md border ${i===0 ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'border-white/20 hover:border-white/50'} rounded-xl cursor-pointer flex flex-col justify-end p-2 snap-center relative overflow-hidden group/cam`}>
                        {i === 0 && <img src="https://images.unsplash.com/photo-1621252179027-94459d278660?w=400&q=80" className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover/cam:opacity-60 transition-opacity" />}
                        <span className="text-[10px] font-bold text-white drop-shadow-md relative z-10 bg-black/50 px-1.5 py-0.5 rounded">{cam}</span>
                     </div>
                   ))}
                </div>
              </>
            )}

            {/* Concierge Event Live Feed */}
            {activeEvent === 2 && (
              <>
                <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=2000&auto=format&fit=crop" alt="Intercom Feed" className="absolute inset-0 w-full h-full object-cover opacity-80" />
                <div className="absolute inset-0 bg-amber-900/10 mix-blend-color pointer-events-none"></div>
                
                {/* Twilio Audio Indicator (Moved down below header) */}
                <div className="absolute top-24 right-6 flex items-center gap-3 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 z-30">
                   <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                   <span className="text-xs font-bold text-white tracking-widest">TWILIO AUDIO ACTIVE</span>
                </div>
                
                {/* ID Capture Viewfinder (Moved to Top Right, vanishes when captured) */}
                {!idCaptured && (
                  <div className="absolute top-36 right-6 w-56 h-36 border-2 border-amber-500/50 border-dashed bg-black/20 flex flex-col items-center justify-center p-2 shadow-2xl z-20 backdrop-blur-sm">
                    <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest bg-black/60 px-2 py-1 rounded">Align ID Here</span>
                    {/* Reticle corners */}
                    <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-amber-500"></div>
                    <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-amber-500"></div>
                    <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-amber-500"></div>
                    <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-amber-500"></div>
                  </div>
                )}
                {idCaptured && (
                  <div className="absolute top-36 right-6 flex items-center gap-2 bg-emerald-500/90 backdrop-blur-md px-4 py-2 rounded-lg border border-white/20 z-30 shadow-lg animate-in fade-in zoom-in">
                     <span className="text-white font-bold text-xs uppercase tracking-widest">✓ ID Captured & Logged</span>
                  </div>
                )}

                {/* Left & Right Bottom PIPs */}
                <div className="absolute bottom-6 w-full px-6 flex justify-between z-30 pointer-events-none">
                  {/* Left: LPR Image */}
                  <div className="w-72 aspect-video bg-black rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)] border border-white/20 pointer-events-auto group/pip hover:scale-105 transition-transform origin-bottom-left cursor-pointer relative">
                    <div className="absolute top-2 left-2 bg-indigo-500/90 backdrop-blur px-2 py-0.5 rounded text-[9px] font-black text-white uppercase tracking-wider z-10">ALPR CAM</div>
                    <img src="https://images.unsplash.com/photo-1600843603403-1724806a6416?q=80&w=800&auto=format&fit=crop" alt="Plate" className="w-full h-full object-cover opacity-90" />
                    <div className="absolute bottom-0 w-full bg-black/80 backdrop-blur px-3 py-2 border-t border-white/10 flex justify-between items-center">
                       <span className="text-xs font-bold text-white tracking-widest">NOSPYN</span>
                       <span className="text-[9px] text-emerald-400 font-mono">MATCH: 98%</span>
                    </div>
                  </div>
                  {/* Right: Drive-Up Image */}
                  <div className="w-72 aspect-video bg-black rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)] border border-white/20 pointer-events-auto group/pip hover:scale-105 transition-transform origin-bottom-right cursor-pointer relative">
                    <div className="absolute top-2 left-2 bg-slate-800/90 backdrop-blur px-2 py-0.5 rounded text-[9px] font-black text-white uppercase tracking-wider z-10">APPROACH WIDE</div>
                    <img src="https://images.unsplash.com/photo-1494976388531-d1058494cdd8?q=80&w=800&auto=format&fit=crop" alt="Wide Approach" className="w-full h-full object-cover opacity-80" />
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          /* TACTICAL MAP RENDERER */
          <div className="flex-1 w-full h-full relative bg-[#17263c] overflow-hidden">
             <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=2074&auto=format&fit=crop" alt="Tactical Map" className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-screen grayscale" />
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                <div className={`absolute -inset-8 rounded-full animate-ping ${activeEvent === 1 ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}></div>
                <div className={`relative w-6 h-6 rounded-full border-[3px] border-white flex items-center justify-center shadow-[0_0_20px_currentColor] ${activeEvent === 1 ? 'bg-emerald-500 text-emerald-500' : 'bg-amber-500 text-amber-500'}`}>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
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
          
          {/* TAB 1: ACTION & SOP */}
          {rightPanelTab === "action" && (
            <div className="flex flex-col h-full">
              {activeEvent === 1 ? (
                /* Standard Action Panel */
                <>
                  <h2 className="text-[10px] font-black text-slate-500 tracking-[0.2em] mb-4">STANDARD SOP</h2>
                  <div className="space-y-3 mb-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                     <label className="flex items-start space-x-3 cursor-pointer group">
                       <input type="checkbox" className="mt-1 w-4 h-4 rounded border-slate-600 bg-black/50 text-emerald-500" />
                       <span className="text-sm text-slate-300 group-hover:text-white transition-colors">Verify vehicle is marked LEO or Emergency.</span>
                     </label>
                  </div>
                  <div className="shrink-0 pt-4 border-t border-white/10">
                    <h2 className="text-[10px] font-black text-slate-500 tracking-[0.2em] mb-3">QUICK RESOLVE</h2>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <button className="bg-slate-800 hover:bg-slate-700 text-[10px] text-white font-bold py-2.5 rounded-xl transition-all border border-slate-700">NOTHING SEEN</button>
                      <button className="bg-emerald-900/40 hover:bg-emerald-900/60 text-[10px] text-emerald-400 font-bold py-2.5 rounded-xl transition-all border border-emerald-500/30">AUTH GUEST</button>
                      <button className="bg-slate-800 hover:bg-slate-700 text-[10px] text-white font-bold py-2.5 rounded-xl transition-all border border-slate-700">FALSE ALARM</button>
                      <button className="bg-rose-900/40 hover:bg-rose-900/60 text-[10px] text-rose-400 font-bold py-2.5 rounded-xl transition-all border border-rose-500/30">DISPATCH LEO</button>
                    </div>
                    <input type="text" placeholder="Custom resolution notes..." className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none mb-3" />
                    <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3.5 rounded-xl transition-all text-xs tracking-widest shadow-lg">LOG TO BRIVO & CLOSE</button>
                  </div>
                </>
              ) : (
                /* Concierge Action Panel */
                <>
                  <h2 className="text-[10px] font-black text-amber-500 tracking-[0.2em] mb-4">CONCIERGE WORKFLOW</h2>
                  <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl mb-4">
                    <p className="text-xs text-amber-200 font-medium italic">
                      {workflowStep === "greeting" && '"Welcome to Avana Chase. Please state the resident you are visiting and hold your ID to the camera."'}
                      {workflowStep === "resident" && '"Thank you, calling the resident now to verify access."'}
                    </p>
                  </div>
                  
                  {workflowStep === "greeting" && (
                    <div className="grid grid-cols-2 gap-2 mb-auto">
                      <button onClick={() => setIdCaptured(true)} className={`text-[10px] font-bold py-3 rounded-xl transition-all border ${idCaptured ? 'bg-emerald-900/40 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700'}`}>
                        {idCaptured ? '✓ ID CAPTURED' : '📸 CAPTURE ID'}
                      </button>
                      <button onClick={() => setWorkflowStep("resident")} className="bg-slate-800 text-white text-[10px] font-bold py-3 rounded-xl border border-slate-700 hover:bg-slate-700">SELECT RESIDENT →</button>
                    </div>
                  )}

                  {workflowStep === "resident" && (
                    <div className="flex flex-col gap-2 mb-auto">
                       <input type="text" placeholder="Search Resident Name..." className="bg-black/40 border border-emerald-500/50 rounded-xl px-4 py-3 text-sm text-white outline-none mb-2" />
                       <div className="bg-black/30 border border-white/5 rounded-xl p-3 flex justify-between items-center">
                         <div className="text-sm font-bold text-white">Sarah Jenkins (Unit 402)</div>
                         <button onClick={() => setCallingResident(!callingResident)} className={`px-4 py-2 rounded-lg text-[10px] font-bold transition-all border ${callingResident ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'}`}>
                           {callingResident ? 'END CALL' : 'CALL'}
                         </button>
                       </div>
                       <button onClick={() => setWorkflowStep("greeting")} className="text-[10px] text-slate-500 hover:text-white font-bold mt-2 text-left">← BACK</button>
                    </div>
                  )}
                  
                  <div className="shrink-0 pt-4 border-t border-white/10 mt-6">
                     <button className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black py-3.5 rounded-xl transition-all text-xs tracking-widest shadow-lg mb-3">🔓 UNLOCK DOOR STATION</button>
                    <button className="w-full bg-slate-700 hover:bg-slate-600 text-white font-black py-3.5 rounded-xl transition-all text-xs tracking-widest shadow-lg">DENY & CLOSE</button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: CONTROLS */}
          {rightPanelTab === "controls" && (
            <div className="flex flex-col h-full">
               <h2 className="text-[10px] font-black text-slate-500 tracking-[0.2em] mb-4">SITE ALARM CONTROLS</h2>
               <div className="flex justify-between items-center p-4 bg-black/30 rounded-2xl border border-white/5 mb-4">
                  <span className="text-sm font-bold text-white">System Status</span>
                  <span className="text-xs font-bold bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span> ARMED
                  </span>
               </div>
               <button className="w-full bg-rose-500/10 text-rose-400 font-bold py-3.5 rounded-xl border border-rose-500/30 mb-8 hover:bg-rose-500/20 transition-all text-sm tracking-wider">
                 DISARM SITE
               </button>
               
               <h2 className="text-[10px] font-black text-amber-500 tracking-[0.2em] mb-4 border-t border-white/10 pt-6">SNOOZE TRIGGERS</h2>
               <div className="grid grid-cols-3 gap-2 mb-3">
                  <button className="bg-amber-500/10 text-amber-400 font-bold py-2.5 rounded-xl border border-amber-500/30 text-xs hover:bg-amber-500/20 transition-all">15m</button>
                  <button className="bg-amber-500/10 text-amber-400 font-bold py-2.5 rounded-xl border border-amber-500/30 text-xs hover:bg-amber-500/20 transition-all">30m</button>
                  <button className="bg-amber-500/10 text-amber-400 font-bold py-2.5 rounded-xl border border-amber-500/30 text-xs hover:bg-amber-500/20 transition-all">1hr</button>
               </div>
               <div className="flex gap-2">
                 <input 
                   type="number" placeholder="Mins" value={customSnooze} onChange={(e) => setCustomSnooze(e.target.value)}
                   className="w-20 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-center text-white focus:border-amber-500/50 outline-none" 
                 />
                 <button className="flex-1 bg-amber-500/20 text-amber-400 font-bold py-2 rounded-xl border border-amber-500/40 text-xs hover:bg-amber-500/30 transition-all">
                   CUSTOM SNOOZE
                 </button>
               </div>
            </div>
          )}

          {/* TAB 3: SITE NOTES */}
          {rightPanelTab === "notes" && (
             <div className="flex flex-col h-full">
               <div className="shrink-0 mb-6">
                 <h2 className="text-[10px] font-black text-slate-500 tracking-[0.2em] mb-3">ADD SITE NOTE</h2>
                 <div className="flex flex-col gap-2">
                   <textarea 
                     placeholder="Type a temporary or permanent note..." value={newNote} onChange={(e) => setNewNote(e.target.value)}
                     className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500/50 outline-none resize-none h-20"
                   />
                   <button onClick={handleAddNote} className="self-end bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-lg transition-all text-xs">
                     Post Note
                   </button>
                 </div>
               </div>
               <h2 className="text-[10px] font-black text-slate-500 tracking-[0.2em] mb-3 border-t border-white/10 pt-4 shrink-0">ACTIVE NOTES</h2>
               <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-3">
                  {notes.map(note => (
                    <div key={note.id} className={`p-3 rounded-xl border relative group ${note.type === 'warning' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-white/5 border-white/10'}`}>
                      <div className="flex justify-between items-start mb-1">
                        <span className={`text-[10px] font-bold ${note.type === 'warning' ? 'text-amber-400' : 'text-emerald-400'}`}>{note.author}</span>
                        <button onClick={() => clearNote(note.id)} className="text-[10px] text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all font-bold">CLEAR</button>
                      </div>
                      <p className="text-sm text-slate-300 leading-snug">{note.text}</p>
                    </div>
                  ))}
               </div>
             </div>
          )}

        </div>
      </div>

    </div>
  );
}
