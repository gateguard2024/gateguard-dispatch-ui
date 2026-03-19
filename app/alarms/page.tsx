"use client";

import React, { useState } from "react";

export default function AlarmsPage() {
  const [canvasView, setCanvasView] = useState("live"); // 'live' or 'map'
  const [rightPanelTab, setRightPanelTab] = useState("action"); // 'action', 'controls', 'notes'

  return (
    <div className="w-full h-full flex gap-6 p-6 relative">
      
      {/* LEFT: ALARM QUEUE & PAST EVENTS */}
      <div className="w-72 flex flex-col gap-4 z-10">
        <div className="flex justify-between items-center bg-white/5 p-1 rounded-xl border border-white/10">
          <button className="flex-1 text-xs font-bold py-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">CURRENT (2)</button>
          <button className="flex-1 text-xs font-bold py-2 rounded-lg text-slate-400 hover:text-white transition-colors">PAST EVENTS</button>
        </div>
        
        {/* Active Alarm Card */}
        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-emerald-500/50 rounded-2xl p-4 shadow-[0_0_30px_rgba(16,185,129,0.1)] cursor-pointer relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded uppercase tracking-wider">Active</span>
            <span className="text-[10px] font-mono text-slate-400">00:14s</span>
          </div>
          <h3 className="text-white font-bold text-lg">Elevate Greene</h3>
          <p className="text-slate-400 text-xs mt-1">Main Gate • Motion Detected</p>
        </div>
      </div>

      {/* CENTER: THE IMMERSIVE CANVAS (Video or Map) */}
      <div className="flex-1 relative rounded-3xl overflow-hidden border border-white/5 shadow-2xl bg-black flex flex-col group">
        
        {/* Canvas Header */}
        <div className="absolute top-0 w-full p-6 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start z-20 pointer-events-none">
          <div className="pointer-events-auto">
            <h1 className="text-2xl font-black text-white tracking-wide drop-shadow-lg flex items-center">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full mr-3 shadow-[0_0_10px_rgba(16,185,129,1)]"></span>
              Elevate Greene
            </h1>
          </div>
          <div className="flex gap-2 bg-black/40 backdrop-blur-md p-1 rounded-xl border border-white/10 pointer-events-auto">
            <button onClick={() => setCanvasView("live")} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${canvasView === "live" ? "bg-white/20 text-white" : "text-slate-400 hover:text-white"}`}>LIVE FEED</button>
            <button onClick={() => setCanvasView("map")} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${canvasView === "map" ? "bg-white/20 text-white" : "text-slate-400 hover:text-white"}`}>TACTICAL MAP</button>
          </div>
        </div>

        {/* CANVAS RENDERER */}
        {canvasView === "live" ? (
          <div className="flex-1 w-full h-full relative flex items-center justify-center bg-[#0a0f18]">
            <span className="tracking-widest font-mono text-sm z-10 text-slate-600">MAIN CAMERA FEED ACTIVE</span>
            {/* Pre-Alarm PiP */}
            <div className="absolute bottom-6 left-6 w-80 aspect-video bg-black/80 backdrop-blur-xl border border-white/20 rounded-2xl overflow-hidden shadow-2xl z-20">
              <div className="absolute top-2 left-2 bg-rose-500/80 backdrop-blur px-2 py-0.5 rounded text-[9px] font-black text-white uppercase tracking-wider">10s Pre-Alarm</div>
            </div>
            {/* Camera Carousel Picker */}
            <div className="absolute bottom-6 right-6 flex gap-2 z-20 overflow-x-auto max-w-md snap-x">
               {["Main Gate", "Leasing Office", "Pool", "Gym"].map((cam, i) => (
                 <div key={cam} className={`shrink-0 w-32 aspect-video bg-black/60 backdrop-blur-md border ${i===0 ? 'border-emerald-500' : 'border-white/20 hover:border-white/50'} rounded-xl cursor-pointer flex items-end p-2 snap-center`}>
                    <span className="text-[10px] font-bold text-white drop-shadow-md">{cam}</span>
                 </div>
               ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 w-full h-full relative bg-[#0f172a] overflow-hidden">
             {/* Fake Map Grid Background */}
             <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
             
             {/* Flashing Camera Node on Map */}
             <div className="absolute top-1/2 left-1/3 group/node cursor-pointer">
                {/* Ping Animation */}
                <div className="absolute -inset-4 bg-rose-500/30 rounded-full animate-ping"></div>
                {/* Node */}
                <div className="relative w-4 h-4 bg-rose-500 rounded-full border-2 border-white shadow-[0_0_15px_rgba(244,63,94,0.8)]"></div>
                {/* Hover Camera Preview */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-48 aspect-video bg-black/90 border border-rose-500/50 rounded-xl opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none flex flex-col items-center justify-center overflow-hidden shadow-2xl z-30">
                   <div className="text-[10px] font-bold text-white bg-rose-500/80 w-full text-center py-1">Main Gate Motion</div>
                   <span className="text-[9px] text-slate-400 mt-2">Live View Placeholder</span>
                </div>
             </div>

             {/* Normal Camera Node on Map */}
             <div className="absolute top-1/3 right-1/4 group/node cursor-pointer">
                <div className="w-3 h-3 bg-emerald-500 rounded-full border-2 border-white shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
             </div>
          </div>
        )}
      </div>

      {/* RIGHT: INTELLIGENCE & ACTION DRAWER */}
      <div className="w-[340px] flex flex-col gap-4 z-10">
        
        {/* Tab Selection */}
        <div className="flex bg-white/5 backdrop-blur-xl border border-white/10 p-1 rounded-2xl">
          <button onClick={() => setRightPanelTab("action")} className={`flex-1 text-[10px] font-black uppercase py-2 rounded-xl transition-all ${rightPanelTab === "action" ? "bg-white/20 text-white" : "text-slate-400 hover:text-white"}`}>Action & SOP</button>
          <button onClick={() => setRightPanelTab("controls")} className={`flex-1 text-[10px] font-black uppercase py-2 rounded-xl transition-all ${rightPanelTab === "controls" ? "bg-white/20 text-white" : "text-slate-400 hover:text-white"}`}>Controls</button>
          <button onClick={() => setRightPanelTab("notes")} className={`flex-1 text-[10px] font-black uppercase py-2 rounded-xl transition-all ${rightPanelTab === "notes" ? "bg-white/20 text-white" : "text-slate-400 hover:text-white"}`}>Site Notes</button>
        </div>

        {/* Action Panel Tab */}
        {rightPanelTab === "action" && (
          <div className="flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 flex flex-col shadow-2xl relative overflow-hidden">
            <h2 className="text-xs font-black text-slate-500 tracking-[0.2em] mb-4">REQUIRED SOP</h2>
            <div className="space-y-3 mb-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
               <label className="flex items-start space-x-3 cursor-pointer group">
                 <input type="checkbox" className="mt-1 w-4 h-4 rounded border-slate-600 bg-black/50 text-emerald-500" />
                 <span className="text-sm text-slate-300 group-hover:text-white transition-colors">Verify vehicle is marked emergency.</span>
               </label>
            </div>

            <h2 className="text-xs font-black text-slate-500 tracking-[0.2em] mb-3">QUICK RESOLVE</h2>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button className="bg-slate-800 hover:bg-slate-700 text-[10px] text-white font-bold py-2 rounded-xl transition-all border border-slate-700">NOTHING SEEN</button>
              <button className="bg-slate-800 hover:bg-slate-700 text-[10px] text-white font-bold py-2 rounded-xl transition-all border border-slate-700">AUTH GUEST</button>
              <button className="bg-slate-800 hover:bg-slate-700 text-[10px] text-white font-bold py-2 rounded-xl transition-all border border-slate-700">FALSE ALARM</button>
              <button className="bg-rose-900/40 hover:bg-rose-900/60 text-[10px] text-rose-400 font-bold py-2 rounded-xl transition-all border border-rose-500/30">DISPATCH LEO</button>
            </div>

            <div>
               <input type="text" placeholder="Add custom notes..." className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500/50 outline-none mb-3" />
               <button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black py-3 rounded-xl shadow-[0_0_15px_rgba(79,70,229,0.4)] hover:scale-[1.02] transition-all text-xs tracking-widest">
                 LOG TO BRIVO & CLOSE
               </button>
            </div>
          </div>
        )}

        {/* Controls Tab (Arming/Snooze) */}
        {rightPanelTab === "controls" && (
          <div className="flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-2xl">
             <h2 className="text-xs font-black text-slate-500 tracking-[0.2em] mb-4">SITE ALARM CONTROLS</h2>
             <div className="flex justify-between items-center p-4 bg-black/30 rounded-2xl border border-white/5 mb-4">
                <span className="text-sm font-bold text-white">System Status</span>
                <span className="text-xs font-bold bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30">ARMED</span>
             </div>
             <button className="w-full bg-rose-500/10 text-rose-400 font-bold py-3 rounded-xl border border-rose-500/30 mb-6 hover:bg-rose-500/20 transition-all text-sm">
               DISARM SITE
             </button>
             
             <h2 className="text-xs font-black text-slate-500 tracking-[0.2em] mb-4">SNOOZE TRIGGERS</h2>
             <div className="grid grid-cols-2 gap-2">
                <button className="bg-amber-500/10 text-amber-400 font-bold py-3 rounded-xl border border-amber-500/30 text-xs hover:bg-amber-500/20">Snooze 15m</button>
                <button className="bg-amber-500/10 text-amber-400 font-bold py-3 rounded-xl border border-amber-500/30 text-xs hover:bg-amber-500/20">Snooze 1hr</button>
             </div>
          </div>
        )}

        {/* Notes & Problems Tab */}
        {rightPanelTab === "notes" && (
           <div className="flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-2xl flex flex-col">
             <h2 className="text-xs font-black text-amber-500 tracking-[0.2em] mb-4">KNOWN SITE PROBLEMS</h2>
             <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl mb-6">
                <p className="text-xs text-amber-200">Main gate arm is sticking. Do not trigger siren if vehicle is stuck, use 2-way audio to advise backing up.</p>
             </div>
             
             <h2 className="text-xs font-black text-slate-500 tracking-[0.2em] mb-4">GENERAL NOTES</h2>
             <div className="flex-1 overflow-y-auto text-sm text-slate-300 space-y-4">
                <p className="pb-3 border-b border-white/10">Property manager on vacation until 3/25. Escalate to Assistant GM.</p>
                <p className="pb-3 border-b border-white/10">Pool is closed for maintenance, any motion inside gate is unauthorized.</p>
             </div>
           </div>
        )}

      </div>
    </div>
  );
}
