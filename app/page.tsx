"use client";

import React, { useState } from "react";

export default function NextLevelApp() {
  const [currentView, setCurrentView] = useState("Alarms");

  return (
    // Radial gradient background for deep, immersive depth
    <div className="flex flex-col h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#05070a] to-black text-slate-200 font-sans overflow-hidden">
      
      {/* 1. MINIMALIST FLOATING HEADER */}
      <header className="absolute top-0 w-full flex items-center justify-between px-6 py-4 z-50 pointer-events-none">
        <div className="flex items-center space-x-8 pointer-events-auto">
          {/* Glowing Logo */}
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => setCurrentView("Dashboard")}>
            <div className="w-10 h-10 bg-black/40 border border-emerald-500/30 backdrop-blur-md rounded-xl flex items-center justify-center font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] group-hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all">
              GG
            </div>
          </div>
          
          {/* Glass Navigation */}
          <nav className="hidden lg:flex space-x-2 bg-white/5 backdrop-blur-lg border border-white/10 p-1.5 rounded-2xl shadow-2xl">
            {["Dashboard", "Alarms", "Setup"].map((item) => (
              <button 
                key={item}
                onClick={() => setCurrentView(item)}
                className={`px-6 py-1.5 text-sm font-bold rounded-xl transition-all ${
                  currentView === item 
                    ? "bg-gradient-to-r from-emerald-500/80 to-teal-500/80 text-white shadow-lg shadow-emerald-500/20" 
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center space-x-6 pointer-events-auto">
          {/* Radar Pulse Indicator */}
          <div className="flex items-center space-x-3 bg-rose-500/10 border border-rose-500/20 backdrop-blur-md px-5 py-2 rounded-2xl">
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </div>
            <span className="text-sm font-bold text-rose-400 tracking-wider">2 CRITICAL</span>
          </div>
          
          {/* Agent Avatar */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600/50 flex items-center justify-center font-bold text-white shadow-lg cursor-pointer hover:border-emerald-500/50 transition-colors">
            RF
          </div>
        </div>
      </header>

      {/* 2. DYNAMIC WORKSPACE */}
      <main className="flex-1 w-full h-full relative pt-20 pb-6 px-6">
        {currentView === "Alarms" && <ImmersiveAlarmsHUD />}
        {currentView !== "Alarms" && (
          <div className="flex h-full items-center justify-center text-slate-500 text-2xl font-light">
            {currentView} Module (Routing Active)
          </div>
        )}
      </main>
    </div>
  );
}

// ==========================================
// THE IMMERSIVE HUD ALARMS VIEW
// ==========================================
function ImmersiveAlarmsHUD() {
  return (
    <div className="w-full h-full flex gap-6 relative">
      
      {/* LEFT: FLOATING ALARM QUEUE */}
      <div className="w-72 flex flex-col gap-3 z-10">
        <h2 className="text-xs font-black text-slate-500 tracking-[0.2em] ml-2 mb-2">INCOMING QUEUE</h2>
        
        {/* Active Alarm Card - Glowing */}
        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-emerald-500/50 rounded-2xl p-4 shadow-[0_0_30px_rgba(16,185,129,0.1)] cursor-pointer relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded uppercase tracking-wider">Active</span>
            <span className="text-[10px] font-mono text-slate-400">00:14s</span>
          </div>
          <h3 className="text-white font-bold text-lg">Elevate Greene</h3>
          <p className="text-slate-400 text-xs mt-1">Main Gate • Motion Detected</p>
        </div>

        {/* Queued Alarm Card */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors cursor-pointer">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded uppercase tracking-wider">Waiting</span>
            <span className="text-[10px] font-mono text-slate-400">02:05s</span>
          </div>
          <h3 className="text-slate-300 font-bold text-lg">Avana Chase</h3>
          <p className="text-slate-500 text-xs mt-1">Leasing Lobby • Forced Entry</p>
        </div>
      </div>

      {/* CENTER: IMMERSIVE VIDEO CANVAS */}
      <div className="flex-1 relative rounded-3xl overflow-hidden border border-white/5 shadow-2xl bg-black flex items-center justify-center group">
        
        {/* Main Live Feed Placeholder */}
        <div className="absolute inset-0 bg-[#0a0f18] flex flex-col items-center justify-center text-slate-600">
           {/* Subtle Grid Background for that "Tech" feel */}
           <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
           <div className="w-16 h-16 border-2 border-slate-800 border-t-emerald-500 rounded-full animate-spin mb-4 z-10"></div>
           <span className="tracking-widest font-mono text-sm z-10">ESTABLISHING SECURE CONNECTION</span>
        </div>

        {/* Video Overlay Top Bar (Camera Details) */}
        <div className="absolute top-0 w-full p-6 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start z-20">
          <div>
            <div className="flex items-center space-x-3">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,1)]"></span>
              <h1 className="text-2xl font-black text-white tracking-wide drop-shadow-lg">Elevate Greene - Main Gate</h1>
            </div>
            <p className="text-slate-300 text-sm mt-1 ml-5 font-medium drop-shadow-md">Gate Guard AI detected vehicle approach.</p>
          </div>
          
          <div className="flex gap-2">
            {["Switch Cam", "Expand"].map(btn => (
              <button key={btn} className="bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/20 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all">
                {btn}
              </button>
            ))}
          </div>
        </div>

        {/* Floating Pre-Alarm PiP (Picture in Picture) */}
        <div className="absolute bottom-6 left-6 w-80 aspect-video bg-black/80 backdrop-blur-xl border border-white/20 rounded-2xl overflow-hidden shadow-2xl group-hover:scale-105 transition-transform origin-bottom-left cursor-pointer z-20">
          <div className="absolute top-2 left-2 bg-rose-500/80 backdrop-blur px-2 py-0.5 rounded text-[9px] font-black text-white uppercase tracking-wider">
            10s Pre-Alarm
          </div>
          <div className="w-full h-full flex items-center justify-center text-slate-500">
             <svg className="w-10 h-10 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          {/* Scrub bar */}
          <div className="absolute bottom-0 w-full h-1 bg-white/20"><div className="w-1/2 h-full bg-rose-500"></div></div>
        </div>
      </div>

      {/* RIGHT: CONTEXTUAL ACTION DRAWER */}
      <div className="w-80 flex flex-col gap-4 z-10">
        
        {/* GateGuard AI Assessment Card */}
        <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 backdrop-blur-xl border border-indigo-500/30 rounded-3xl p-5 shadow-xl relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/20 blur-3xl rounded-full"></div>
          <div className="flex items-center space-x-2 mb-3">
            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            <h3 className="text-xs font-black text-indigo-300 uppercase tracking-widest">AI Copilot</h3>
          </div>
          <p className="text-sm text-indigo-100 font-medium leading-relaxed">
            Vehicle detected. License plate matches resident profile <span className="text-white font-bold bg-indigo-500/30 px-1 rounded">XYZ-1234</span>. Auto-open suggested.
          </p>
        </div>

        {/* Action & Resolution Container */}
        <div className="flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 flex flex-col shadow-2xl relative overflow-hidden">
          
          <h2 className="text-xs font-black text-slate-500 tracking-[0.2em] mb-4">COMMAND CENTER</h2>

          {/* SOP Checklist */}
          <div className="space-y-3 mb-6 flex-1">
             <label className="flex items-start space-x-3 cursor-pointer group">
               <input type="checkbox" className="mt-1 w-4 h-4 rounded border-slate-600 bg-black/50 text-emerald-500 focus:ring-emerald-500/50" />
               <span className="text-sm text-slate-300 group-hover:text-white transition-colors">Verify vehicle is marked emergency.</span>
             </label>
             <label className="flex items-start space-x-3 cursor-pointer group">
               <input type="checkbox" className="mt-1 w-4 h-4 rounded border-slate-600 bg-black/50 text-emerald-500 focus:ring-emerald-500/50" />
               <span className="text-sm text-slate-300 group-hover:text-white transition-colors">If guest, verify name via 2-way audio.</span>
             </label>
          </div>

          {/* Primary Action Buttons */}
          <div className="space-y-3 mb-6">
            <button className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black py-4 px-4 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all flex justify-center items-center tracking-wider">
              OPEN MAIN GATE
            </button>
            <div className="flex gap-3">
              <button className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-2xl transition-all text-sm border border-white/10">
                2-Way Audio
              </button>
              <button className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold py-3 rounded-2xl transition-all text-sm border border-rose-500/20">
                Trigger Siren
              </button>
            </div>
          </div>

          {/* Instant Logging */}
          <div>
             <input 
               type="text" 
               placeholder="Type resolution notes and press Enter..." 
               className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-4 text-sm text-white focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 focus:outline-none transition-all placeholder:text-slate-500 shadow-inner"
             />
          </div>

        </div>
      </div>

    </div>
  );
}
