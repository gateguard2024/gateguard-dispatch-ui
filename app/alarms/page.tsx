"use client";

import React, { useState } from "react";

export default function AlarmsPage() {
  const [canvasView, setCanvasView] = useState("live"); // 'live' or 'map'
  const [rightPanelTab, setRightPanelTab] = useState("action"); // 'action', 'controls', 'notes'
  const [leftPanelTab, setLeftPanelTab] = useState("current"); // 'current' or 'past'

  // Mock Data for interactions
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
    <div className="w-full h-full flex gap-6 p-6 relative">
      
      {/* LEFT: ALARM QUEUE & PAST EVENTS */}
      <div className="w-80 flex flex-col gap-4 z-10 shrink-0">
        
        {/* Toggle Bar */}
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 backdrop-blur-md">
          <button 
            onClick={() => setLeftPanelTab("current")}
            className={`flex-1 text-[10px] font-black tracking-widest py-2.5 rounded-lg transition-all ${leftPanelTab === "current" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-slate-400 hover:text-white"}`}
          >
            CURRENT (2)
          </button>
          <button 
            onClick={() => setLeftPanelTab("past")}
            className={`flex-1 text-[10px] font-black tracking-widest py-2.5 rounded-lg transition-all ${leftPanelTab === "past" ? "bg-white/20 text-white border border-white/10" : "text-slate-400 hover:text-white"}`}
          >
            PAST EVENTS
          </button>
        </div>
        
        {/* CURRENT QUEUE VIEW */}
        {leftPanelTab === "current" && (
          <div className="flex flex-col gap-3">
            {/* Active Alarm Card */}
            <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-emerald-500/50 rounded-2xl p-4 shadow-[0_0_30px_rgba(16,185,129,0.15)] cursor-pointer relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,1)]"></div>
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded uppercase tracking-widest animate-pulse">Active</span>
                <span className="text-[10px] font-mono text-slate-400">00:14s</span>
              </div>
              <h3 className="text-white font-bold text-lg group-hover:text-emerald-400 transition-colors">Elevate Greene</h3>
              <p className="text-slate-400 text-xs mt-1">Main Gate • Motion Detected</p>
            </div>

            {/* Queued Alarm Card */}
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors cursor-pointer">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-black bg-rose-500/20 text-rose-400 px-2.5 py-1 rounded uppercase tracking-widest">Waiting</span>
                <span className="text-[10px] font-mono text-slate-400">02:05s</span>
              </div>
              <h3 className="text-slate-300 font-bold text-lg">Avana Chase</h3>
              <p className="text-slate-500 text-xs mt-1">Leasing Lobby • Forced Entry</p>
            </div>
          </div>
        )}

        {/* PAST EVENTS VIEW */}
        {leftPanelTab === "past" && (
          <div className="flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar">
            {[
              { time: "16:42", site: "Elevate Greene", event: "Delivery Scan", outcome: "Auth Guest", color: "text-emerald-400" },
              { time: "15:10", site: "Avana Chase", event: "Fence Line", outcome: "Nothing Seen", color: "text-slate-400" },
              { time: "14:05", site: "Dunwoody Vill.", event: "Gate Forced", outcome: "Dispatch LEO", color: "text-rose-400" },
              { time: "11:30", site: "Elevate Greene", event: "Pool Motion", outcome: "False Alarm", color: "text-amber-400" },
            ].map((evt, i) => (
              <div key={i} className="bg-white/5 border border-white/5 p-3 rounded-xl hover:bg-white/10 transition-colors cursor-pointer flex flex-col gap-1">
                 <div className="flex justify-between items-center">
                   <span className="text-xs font-bold text-white">{evt.site}</span>
                   <span className="text-[10px] font-mono text-slate-500">{evt.time}</span>
                 </div>
                 <div className="flex justify-between items-center">
                   <span className="text-[10px] text-slate-400 uppercase tracking-wider">{evt.event}</span>
                   <span className={`text-[10px] font-bold ${evt.color}`}>{evt.outcome}</span>
                 </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CENTER: THE IMMERSIVE CANVAS (Video or Map) */}
      <div className="flex-1 relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-black flex flex-col group">
        
        {/* Canvas Header (With new Site Contact Info) */}
        <div className="absolute top-0 w-full p-6 bg-gradient-to-b from-black/90 via-black/50 to-transparent flex justify-between items-start z-30 pointer-events-none">
          <div className="pointer-events-auto flex flex-col gap-3">
            <h1 className="text-3xl font-black text-white tracking-wide drop-shadow-lg flex items-center">
              <span className="w-3 h-3 bg-emerald-500 rounded-full mr-4 shadow-[0_0_15px_rgba(16,185,129,1)]"></span>
              Elevate Greene
            </h1>
            
            {/* Unobtrusive Site Intelligence Badges */}
            <div className="flex gap-2 opacity-80 hover:opacity-100 transition-opacity">
               <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg text-[10px] font-medium text-slate-300">
                 <span>📍</span> 123 Main St, Sandy Springs, GA
               </div>
               <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg text-[10px] font-medium text-slate-300">
                 <span>📞</span> Desk: (555) 123-4567
               </div>
               <div className="flex items-center gap-1.5 bg-rose-500/20 backdrop-blur-md border border-rose-500/30 px-3 py-1.5 rounded-lg text-[10px] font-bold text-rose-300">
                 <span>🚨</span> Emer: (555) 911-0000
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
            {/* Realistic Camera Image Placeholder */}
            <img 
              src="https://images.unsplash.com/photo-1621252179027-94459d278660?q=80&w=2070&auto=format&fit=crop" 
              alt="Live Feed" 
              className="absolute inset-0 w-full h-full object-cover opacity-80"
            />
            {/* Camera Overlay Grid */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/scan-lines-light.png')] opacity-30 mix-blend-overlay"></div>
            
            {/* Pre-Alarm PiP */}
            <div className="absolute bottom-6 left-6 w-80 aspect-video bg-black rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)] border border-white/20 z-20 group/pip hover:scale-105 transition-transform cursor-pointer origin-bottom-left">
              <div className="absolute top-2 left-2 bg-rose-500/90 backdrop-blur px-2 py-0.5 rounded text-[9px] font-black text-white uppercase tracking-wider z-10 shadow-md">10s Pre-Alarm</div>
              <img 
                src="https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=2070&auto=format&fit=crop" 
                alt="Pre-Alarm" 
                className="w-full h-full object-cover opacity-90"
              />
              <div className="absolute bottom-0 w-full h-1 bg-white/20"><div className="w-2/3 h-full bg-rose-500"></div></div>
            </div>

            {/* Camera Carousel Picker */}
            <div className="absolute bottom-6 right-6 flex gap-3 z-20 overflow-x-auto max-w-md snap-x p-1">
               {["Main Gate", "Leasing Office", "Pool", "Gym"].map((cam, i) => (
                 <div key={cam} className={`shrink-0 w-32 aspect-video bg-black/80 backdrop-blur-md border ${i===0 ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'border-white/20 hover:border-white/50'} rounded-xl cursor-pointer flex flex-col justify-end p-2 snap-center relative overflow-hidden group/cam`}>
                    {i === 0 && <img src="https://images.unsplash.com/photo-1621252179027-94459d278660?w=400&q=80" className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover/cam:opacity-60 transition-opacity" />}
                    <span className="text-[10px] font-bold text-white drop-shadow-md relative z-10 bg-black/50 px-1.5 py-0.5 rounded">{cam}</span>
                 </div>
               ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 w-full h-full relative bg-[#060913] overflow-hidden">
             {/* Realistic Dark Map Background */}
             <img 
               src="https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=2074&auto=format&fit=crop" 
               alt="Tactical Map" 
               className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-luminosity grayscale"
             />
             <div className="absolute inset-0 bg-blue-900/10 mix-blend-color"></div>
             
             {/* Flashing Camera Node on Map */}
             <div className="absolute top-1/2 left-1/3 group/node cursor-pointer z-20">
                <div className="absolute -inset-6 bg-rose-500/20 rounded-full animate-ping"></div>
                <div className="relative w-5 h-5 bg-rose-500 rounded-full border-[3px] border-white shadow-[0_0_20px_rgba(244,63,94,1)] flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                </div>
                
                {/* Hover Camera Preview on Map */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-56 aspect-video bg-black border border-rose-500/50 rounded-xl opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none flex flex-col overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-30 transform group-hover/node:-translate-y-2 duration-200">
                   <div className="text-[10px] font-black text-white bg-rose-500/90 w-full text-center py-1 tracking-widest flex justify-center items-center gap-2">
                     <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span> MOTION DETECTED
                   </div>
                   <img src="https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&q=80" className="w-full flex-1 object-cover" />
                </div>
             </div>

             {/* Normal Camera Node on Map */}
             <div className="absolute top-1/3 right-1/4 group/node cursor-pointer z-10 hover:z-20">
                <div className="w-4 h-4 bg-emerald-500 rounded-full border-2 border-white shadow-[0_0_10px_rgba(16,185,129,0.8)] transition-transform hover:scale-125"></div>
             </div>
          </div>
        )}
      </div>

      {/* RIGHT: INTELLIGENCE & ACTION DRAWER */}
      <div className="w-[360px] flex flex-col gap-4 z-10 shrink-0">
        
        {/* PERSISTENT AI COPILOT */}
        <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 backdrop-blur-xl border border-indigo-500/40 rounded-3xl p-5 shadow-xl relative overflow-hidden shrink-0">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none"></div>
          <div className="flex items-center space-x-2 mb-3 relative z-10">
            <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            <h3 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">GateGuard AI Copilot</h3>
          </div>
          <p className="text-xs text-indigo-100/90 font-medium leading-relaxed relative z-10">
            Vehicle detected. License plate matches resident profile <span className="text-white font-bold bg-indigo-500/40 px-1.5 py-0.5 rounded border border-indigo-400/50 mx-1">XYZ-1234</span>. Auto-open suggested.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-white/5 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl shrink-0">
          <button onClick={() => setRightPanelTab("action")} className={`flex-1 text-[10px] font-black uppercase py-2.5 rounded-xl transition-all tracking-wider ${rightPanelTab === "action" ? "bg-white/20 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}>Action & SOP</button>
          <button onClick={() => setRightPanelTab("controls")} className={`flex-1 text-[10px] font-black uppercase py-2.5 rounded-xl transition-all tracking-wider ${rightPanelTab === "controls" ? "bg-white/20 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}>Controls</button>
          <button onClick={() => setRightPanelTab("notes")} className={`flex-1 text-[10px] font-black uppercase py-2.5 rounded-xl transition-all tracking-wider ${rightPanelTab === "notes" ? "bg-white/20 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}>Site Notes</button>
        </div>

        {/* RIGHT PANEL CONTENT AREA */}
        <div className="flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 flex flex-col shadow-2xl relative overflow-hidden min-h-0">
          
          {/* Action Panel Tab */}
          {rightPanelTab === "action" && (
            <div className="flex flex-col h-full">
              <h2 className="text-[10px] font-black text-slate-500 tracking-[0.2em] mb-4">REQUIRED SOP</h2>
              <div className="space-y-3 mb-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                 <label className="flex items-start space-x-3 cursor-pointer group">
                   <input type="checkbox" className="mt-1 w-4 h-4 rounded border-slate-600 bg-black/50 text-emerald-500 focus:ring-emerald-500/50" />
                   <span className="text-sm text-slate-300 group-hover:text-white transition-colors">Verify vehicle is marked emergency.</span>
                 </label>
                 <label className="flex items-start space-x-3 cursor-pointer group">
                   <input type="checkbox" className="mt-1 w-4 h-4 rounded border-slate-600 bg-black/50 text-emerald-500 focus:ring-emerald-500/50" />
                   <span className="text-sm text-slate-300 group-hover:text-white transition-colors">If guest, verify name via 2-way audio.</span>
                 </label>
              </div>

              <div className="shrink-0 pt-4 border-t border-white/10">
                <h2 className="text-[10px] font-black text-slate-500 tracking-[0.2em] mb-3">QUICK RESOLVE</h2>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button className="bg-slate-800 hover:bg-slate-700 text-[10px] text-white font-bold py-2.5 rounded-xl transition-all border border-slate-700">NOTHING SEEN</button>
                  <button className="bg-emerald-900/40 hover:bg-emerald-900/60 text-[10px] text-emerald-400 font-bold py-2.5 rounded-xl transition-all border border-emerald-500/30">AUTH GUEST</button>
                  <button className="bg-slate-800 hover:bg-slate-700 text-[10px] text-white font-bold py-2.5 rounded-xl transition-all border border-slate-700">FALSE ALARM</button>
                  <button className="bg-rose-900/40 hover:bg-rose-900/60 text-[10px] text-rose-400 font-bold py-2.5 rounded-xl transition-all border border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.1)]">DISPATCH LEO</button>
                </div>
                <input type="text" placeholder="Add custom resolution..." className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500/50 outline-none mb-3 placeholder:text-slate-500" />
                <button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black py-3.5 rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all text-xs tracking-widest">
                  LOG & CLOSE ALARM
                </button>
              </div>
            </div>
          )}

          {/* Controls Tab (Arming/Snooze) */}
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
                   type="number" 
                   placeholder="Mins" 
                   value={customSnooze}
                   onChange={(e) => setCustomSnooze(e.target.value)}
                   className="w-20 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-center text-white focus:border-amber-500/50 outline-none placeholder:text-slate-500" 
                 />
                 <button className="flex-1 bg-amber-500/20 text-amber-400 font-bold py-2 rounded-xl border border-amber-500/40 text-xs hover:bg-amber-500/30 transition-all">
                   CUSTOM SNOOZE
                 </button>
               </div>
            </div>
          )}

          {/* Notes Tab */}
          {rightPanelTab === "notes" && (
             <div className="flex flex-col h-full">
               
               {/* Add Note Input */}
               <div className="shrink-0 mb-6">
                 <h2 className="text-[10px] font-black text-slate-500 tracking-[0.2em] mb-3">ADD SITE NOTE</h2>
                 <div className="flex flex-col gap-2">
                   <textarea 
                     placeholder="Type a temporary or permanent note..." 
                     value={newNote}
                     onChange={(e) => setNewNote(e.target.value)}
                     className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500/50 outline-none resize-none h-20 placeholder:text-slate-500"
                   />
                   <button 
                     onClick={handleAddNote}
                     className="self-end bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-lg transition-all text-xs"
                   >
                     Post Note
                   </button>
                 </div>
               </div>

               {/* Notes List */}
               <h2 className="text-[10px] font-black text-slate-500 tracking-[0.2em] mb-3 border-t border-white/10 pt-4 shrink-0">ACTIVE NOTES</h2>
               <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-3">
                  {notes.map(note => (
                    <div key={note.id} className={`p-3 rounded-xl border relative group ${note.type === 'warning' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-white/5 border-white/10'}`}>
                      <div className="flex justify-between items-start mb-1">
                        <span className={`text-[10px] font-bold ${note.type === 'warning' ? 'text-amber-400' : 'text-emerald-400'}`}>{note.author}</span>
                        <button 
                          onClick={() => clearNote(note.id)}
                          className="text-[10px] text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all font-bold"
                        >
                          CLEAR
                        </button>
                      </div>
                      <p className="text-sm text-slate-300 leading-snug">{note.text}</p>
                    </div>
                  ))}
                  {notes.length === 0 && (
                    <div className="text-center text-slate-500 text-sm italic mt-4">No active notes for this site.</div>
                  )}
               </div>
             </div>
          )}

        </div>
      </div>

    </div>
  );
}
