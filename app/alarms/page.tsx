"use client";

import React from "react";

export default function AlarmsPage() {
  return (
    <div className="w-full h-full flex gap-6 p-6 relative">
      
      {/* LEFT: FLOATING ALARM QUEUE */}
      <div className="w-72 flex flex-col gap-3 z-10">
        <h2 className="text-xs font-black text-slate-500 tracking-[0.2em] ml-2 mb-2">INCOMING QUEUE</h2>
        
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

      {/* CENTER: IMMERSIVE VIDEO CANVAS */}
      <div className="flex-1 relative rounded-3xl overflow-hidden border border-white/5 shadow-2xl bg-black flex items-center justify-center group">
        <div className="absolute inset-0 bg-[#0a0f18] flex flex-col items-center justify-center text-slate-600">
           <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
           <div className="w-16 h-16 border-2 border-slate-800 border-t-emerald-500 rounded-full animate-spin mb-4 z-10"></div>
           <span className="tracking-widest font-mono text-sm z-10">ESTABLISHING SECURE CONNECTION</span>
        </div>

        <div className="absolute top-0 w-full p-6 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start z-20">
          <div>
            <div className="flex items-center space-x-3">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,1)]"></span>
              <h1 className="text-2xl font-black text-white tracking-wide drop-shadow-lg">Elevate Greene - Main Gate</h1>
            </div>
          </div>
        </div>

        {/* Floating Pre-Alarm PiP */}
        <div className="absolute bottom-6 left-6 w-80 aspect-video bg-black/80 backdrop-blur-xl border border-white/20 rounded-2xl overflow-hidden shadow-2xl z-20">
          <div className="absolute top-2 left-2 bg-rose-500/80 backdrop-blur px-2 py-0.5 rounded text-[9px] font-black text-white uppercase tracking-wider">10s Pre-Alarm</div>
          <div className="w-full h-full flex items-center justify-center text-slate-500">
             <span className="text-xs font-mono">CLIP LOADING...</span>
          </div>
        </div>
      </div>

      {/* RIGHT: CONTEXTUAL ACTION DRAWER */}
      <div className="w-80 flex flex-col gap-4 z-10">
        <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 backdrop-blur-xl border border-indigo-500/30 rounded-3xl p-5 shadow-xl relative overflow-hidden">
          <div className="flex items-center space-x-2 mb-3">
            <h3 className="text-xs font-black text-indigo-300 uppercase tracking-widest">AI Copilot</h3>
          </div>
          <p className="text-sm text-indigo-100 font-medium leading-relaxed">
            Vehicle detected. License plate matches profile <span className="text-white font-bold bg-indigo-500/30 px-1 rounded">XYZ-1234</span>. Auto-open suggested.
          </p>
        </div>

        <div className="flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 flex flex-col shadow-2xl">
          <h2 className="text-xs font-black text-slate-500 tracking-[0.2em] mb-4">COMMAND CENTER</h2>
          <div className="space-y-3 mb-6">
            <button className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black py-4 px-4 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:scale-[1.02] transition-transform tracking-wider">
              OPEN MAIN GATE
            </button>
          </div>
          <input 
            type="text" 
            placeholder="Type resolution notes and press Enter..." 
            className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-4 text-sm text-white focus:border-emerald-500/50 outline-none mt-auto"
          />
        </div>
      </div>

    </div>
  );
}
