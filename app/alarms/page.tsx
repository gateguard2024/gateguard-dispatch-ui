"use client";

import React, { useState } from "react";

export default function AlarmsPage() {
  const [activeCam, setActiveCam] = useState("10059648");

  return (
    <div className="w-full h-full flex gap-4 p-4 lg:p-6 overflow-hidden">
      
      {/* 🔴 LEFT PANEL: Dynamic Alert Queue (Replaces your old Alarms Table) */}
      <div className="w-80 flex flex-col gap-4">
        
        <div className="bg-[#0a0c10] border border-white/5 rounded-[2rem] p-5 flex-1 flex flex-col shadow-xl">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-[11px] font-black text-white uppercase tracking-widest">Priority Queue</h3>
                <span className="bg-red-500/20 text-red-500 px-2 py-0.5 rounded text-[9px] font-black">2 CRITICAL</span>
            </div>
            
            {/* Alarm Cards replacing the IMMIX spreadsheet rows */}
            <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 pr-1">
                <div className="p-4 bg-red-600/10 border border-red-500/30 rounded-2xl cursor-pointer shadow-inner relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                    <div className="flex justify-between items-start mb-1">
                        <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">Motion Detected</span>
                        <span className="text-[9px] text-slate-400 font-mono">08:25 AM</span>
                    </div>
                    <span className="text-sm font-bold text-white block">Elevate Greene - Lobby</span>
                </div>

                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl cursor-pointer hover:bg-white/10 transition-all">
                    <div className="flex justify-between items-start mb-1">
                        <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Scheduled Patrol</span>
                        <span className="text-[9px] text-slate-400 font-mono">08:00 PM</span>
                    </div>
                    <span className="text-sm font-bold text-white block">Marbella - Pool Deck</span>
                </div>
            </div>
        </div>
      </div>

      {/* 🖥️ CENTER PANEL: Video Canvas */}
      <div className="flex-1 bg-black border border-white/5 rounded-[2.5rem] relative overflow-hidden shadow-2xl flex flex-col">
          {/* Your EEN Video Engine goes here. Imagine Edge-to-Edge video. */}
          <div className="absolute inset-0 flex items-center justify-center">
             <span className="text-slate-800 text-xs font-black tracking-[1em] uppercase">EEN V3 Streaming Engine</span>
          </div>
          
          {/* Overlay Video Controls */}
          <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end pointer-events-none">
             <div className="bg-black/60 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-xl pointer-events-auto">
                 <span className="text-xs font-bold text-white">Elevate Greene - Lobby</span>
             </div>
          </div>
      </div>

      {/* ⚡ RIGHT PANEL: Operator Action Center */}
      <div className="w-[320px] shrink-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
        
        {/* ACTION: Site Intercom & Gates (Brivo) */}
        <div className="bg-[#0a0c10] border border-white/5 rounded-[2rem] p-6 shadow-xl">
            <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Hardware Control</h3>
            <div className="grid grid-cols-2 gap-3">
                <button className="col-span-2 bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-xl text-[11px] font-black tracking-widest shadow-lg shadow-indigo-900/30 transition-all active:scale-95 flex items-center justify-center gap-2">
                    <span>🔓</span> PULSE LOBBY DOOR
                </button>
                <button className="bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-500 py-3 rounded-xl text-[10px] font-black tracking-widest transition-all">
                    🔊 AUDIO OUT
                </button>
                <button className="bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 py-3 rounded-xl text-[10px] font-black tracking-widest transition-all">
                    🚨 SIREN
                </button>
            </div>
        </div>

        {/* ACTION: AI Assistant & Context */}
        <div className="bg-[#0a0c10] border border-white/5 rounded-[2rem] p-6 shadow-xl flex flex-col">
            <h3 className="text-[10px] font-black text-blue-400 uppercase mb-4 tracking-widest flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span> AI Threat Analysis
            </h3>
            <div className="p-4 bg-blue-900/10 border border-blue-500/20 rounded-xl mb-4">
                <p className="text-xs text-blue-200 leading-relaxed">
                    System detected <span className="font-bold text-white">Unrecognized Individual</span> lingering near front lobby access panel for > 45 seconds. No credential presented.
                </p>
            </div>
            
            {/* Emergency Contacts */}
            <h3 className="text-[10px] font-black text-slate-500 uppercase mb-3 tracking-widest">Site Contacts</h3>
            <div className="space-y-2">
                <button className="w-full flex justify-between items-center p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all border border-white/5">
                    <span className="text-[11px] font-bold">Local PD Dispatch</span>
                    <span className="text-[10px] font-mono text-slate-400">CALL 📞</span>
                </button>
                <button className="w-full flex justify-between items-center p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all border border-white/5">
                    <span className="text-[11px] font-bold">Courtesy Officer (Mitul)</span>
                    <span className="text-[10px] font-mono text-slate-400">CALL 📞</span>
                </button>
            </div>
        </div>

        {/* ACTION: SOP / Flagging */}
        <div className="bg-gradient-to-br from-[#0a0c10] to-[#030406] border border-white/5 rounded-[2rem] p-6 shadow-xl">
            <h3 className="text-[10px] font-black text-indigo-400 uppercase mb-4 tracking-widest">Protocol</h3>
            <div className="space-y-4 opacity-60 mb-6">
              {["Visual Check", "ID Match", "Log Incident"].map(t => (
                <div key={t} className="flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-white/20 rounded md bg-black/40"></div>
                  <span className="text-[11px] font-bold text-slate-300">{t}</span>
                </div>
              ))}
            </div>
            <button className="w-full bg-red-600 hover:bg-red-500 py-3.5 rounded-xl text-[10px] font-black transition-all shadow-lg shadow-red-900/40 tracking-widest">
                DISMISS ALARM
            </button>
        </div>

      </div>
    </div>
  );
}
