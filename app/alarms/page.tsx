"use client";

import React, { useState } from "react";

export default function AutonomousAlarmsPage() {
  const [activeEvent, setActiveEvent] = useState(1);
  const [pendingEvent, setPendingEvent] = useState<number | null>(null);
  const [showParkModal, setShowParkModal] = useState(false);
  
  // Dynamic Script State
  const [workflowStep, setWorkflowStep] = useState("greeting"); // greeting, delivery, resident, ems
  const [idCaptured, setIdCaptured] = useState(false);

  // Handle switching events (Forces Parking)
  const handleEventSwitch = (eventId: number) => {
    if (activeEvent !== eventId) {
      setPendingEvent(eventId);
      setShowParkModal(true);
    }
  };

  const confirmPark = () => {
    if (pendingEvent) setActiveEvent(pendingEvent);
    setShowParkModal(false);
    setWorkflowStep("greeting");
    setIdCaptured(false);
  };

  return (
    <div className="w-full h-full flex gap-6 p-6 relative bg-[#05070a]">
      
      {/* PARK EVENT MODAL */}
      {showParkModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 shadow-2xl max-w-sm w-full text-center">
            <div className="text-4xl mb-4">⏸️</div>
            <h2 className="text-xl font-bold text-white mb-2">Active Event in Progress</h2>
            <p className="text-sm text-slate-400 mb-6">You must park the current event before switching to a new alarm.</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button onClick={() => confirmPark()} className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/50 py-3 rounded-xl font-bold text-sm transition-all">Park 1 Min</button>
              <button onClick={() => confirmPark()} className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/50 py-3 rounded-xl font-bold text-sm transition-all">Park 5 Min</button>
            </div>
            <button onClick={() => setShowParkModal(false)} className="w-full text-slate-500 hover:text-white text-xs font-bold py-2">CANCEL SWITCH</button>
          </div>
        </div>
      )}

      {/* LEFT: TRIAGE QUEUE */}
      <div className="w-80 flex flex-col gap-4 z-10 shrink-0">
        <div className="flex justify-between items-center bg-white/5 px-4 py-3 rounded-xl border border-white/10 backdrop-blur-md">
          <span className="text-xs font-black tracking-widest text-emerald-400">INCOMING QUEUE</span>
          <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-1 rounded-full font-bold border border-emerald-500/30">3 LIVE</span>
        </div>
        
        <div className="flex flex-col gap-3">
          {/* Active Event - Concierge Call */}
          <div 
            onClick={() => handleEventSwitch(1)}
            className={`rounded-2xl p-4 cursor-pointer relative overflow-hidden transition-all ${activeEvent === 1 ? 'bg-gradient-to-br from-slate-800 to-slate-900 border border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
          >
            {activeEvent === 1 && <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>}
            <div className="flex justify-between items-start mb-2">
              <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${activeEvent === 1 ? 'bg-amber-500/20 text-amber-400' : 'text-slate-500 border border-slate-700'}`}>P2 CONCIERGE</span>
              <span className="text-[10px] font-mono text-slate-400">Live</span>
            </div>
            <h3 className={`font-bold text-lg ${activeEvent === 1 ? 'text-white' : 'text-slate-300'}`}>Elevate Greene</h3>
            <p className="text-slate-400 text-xs mt-1">Door Station • Visitor Call</p>
          </div>

          {/* Queued Event - Gate Motion */}
          <div 
            onClick={() => handleEventSwitch(2)}
            className={`rounded-2xl p-4 cursor-pointer relative overflow-hidden transition-all ${activeEvent === 2 ? 'bg-gradient-to-br from-slate-800 to-slate-900 border border-emerald-500/50' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
          >
            {activeEvent === 2 && <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>}
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest text-slate-500 border border-slate-700">P4 STANDARD</span>
              <span className="text-[10px] font-mono text-slate-400">01:45s</span>
            </div>
            <h3 className="text-slate-300 font-bold text-lg">Dunwoody Village</h3>
            <p className="text-slate-500 text-xs mt-1">Main Gate • Vehicle Approach</p>
          </div>
        </div>
      </div>

      {/* CENTER: TRI-VIEW CONCIERGE CANVAS */}
      <div className="flex-1 relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-black flex flex-col group">
        
        {/* Header Overlay */}
        <div className="absolute top-0 w-full p-6 bg-gradient-to-b from-black/90 to-transparent flex justify-between items-start z-30 pointer-events-none">
          <div className="pointer-events-auto">
            <h1 className="text-3xl font-black text-white tracking-wide drop-shadow-lg flex items-center mb-2">
              <span className="w-3 h-3 bg-amber-500 rounded-full mr-4 shadow-[0_0_15px_rgba(245,158,11,1)]"></span> Elevate Greene
            </h1>
            <div className="flex gap-2 text-[10px] font-medium text-slate-300">
               <span className="bg-black/50 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg">📍 123 Main St, Sandy Springs</span>
               <span className="bg-black/50 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg">📞 Desk: (555) 123-4567</span>
            </div>
          </div>
        </div>

        {/* 1. CENTER: LIVE TWILIO / WEBRTC INTERCOM FEED */}
        <div className="flex-1 w-full h-full relative">
          <img src="https://images.unsplash.com/photo-1542327898-d17dc9c735d4?q=80&w=2000&auto=format&fit=crop" alt="Driver Feed" className="absolute inset-0 w-full h-full object-cover opacity-90" />
          <div className="absolute inset-0 bg-blue-900/10 mix-blend-color pointer-events-none"></div>

          {/* Twilio Audio Indicator */}
          <div className="absolute top-6 right-6 flex items-center gap-3 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 z-30">
             <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
             <span className="text-xs font-bold text-white tracking-widest">TWILIO ACTIVE</span>
          </div>

          {/* ID Capture Overlay */}
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-48 border-2 transition-all duration-300 flex flex-col items-center justify-end p-4 shadow-[0_0_50px_rgba(0,0,0,0.5)] z-20 ${idCaptured ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/30 border-dashed bg-black/10'}`}>
             {idCaptured && (
               <div className="absolute bottom-4 text-center bg-emerald-500/90 backdrop-blur px-3 py-1 rounded border border-white/20 shadow-lg">
                 <span className="text-[10px] font-bold text-white uppercase tracking-widest">ID Logged to Supabase</span>
               </div>
             )}
          </div>
        </div>

        {/* BOTTOM CORNER PIPS */}
        <div className="absolute bottom-6 w-full px-6 flex justify-between z-30 pointer-events-none">
          
          {/* 2. LEFT PIP: LPR (License Plate Recognition) */}
          <div className="w-80 aspect-video bg-black rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)] border border-white/20 pointer-events-auto group/pip hover:scale-105 transition-transform origin-bottom-left cursor-pointer relative">
            <div className="absolute top-2 left-2 bg-indigo-500/90 backdrop-blur px-2 py-0.5 rounded text-[9px] font-black text-white uppercase tracking-wider z-10">ALPR CAM</div>
            <img src="https://images.unsplash.com/photo-1600843603403-1724806a6416?q=80&w=800&auto=format&fit=crop" alt="Plate" className="w-full h-full object-cover opacity-90" />
            <div className="absolute bottom-0 w-full bg-black/80 backdrop-blur px-3 py-2 border-t border-white/10 flex justify-between items-center">
               <span className="text-xs font-bold text-white tracking-widest">NOSPYN</span>
               <span className="text-[9px] text-emerald-400 font-mono">CONFIDENCE: 98%</span>
            </div>
          </div>

          {/* 3. RIGHT PIP: WIDE ANGLE APPROACH */}
          <div className="w-80 aspect-video bg-black rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)] border border-white/20 pointer-events-auto group/pip hover:scale-105 transition-transform origin-bottom-right cursor-pointer relative">
            <div className="absolute top-2 left-2 bg-slate-800/90 backdrop-blur px-2 py-0.5 rounded text-[9px] font-black text-white uppercase tracking-wider z-10">APPROACH WIDE</div>
            <img src="https://images.unsplash.com/photo-1494976388531-d1058494cdd8?q=80&w=800&auto=format&fit=crop" alt="Wide Approach" className="w-full h-full object-cover opacity-80" />
          </div>
        </div>
      </div>

      {/* RIGHT: DYNAMIC WORKFLOW DRAWER */}
      <div className="w-[380px] flex flex-col gap-4 z-10 shrink-0">
        
        {/* DYNAMIC CONVERSATIONAL SCRIPT */}
        <div className="flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 flex flex-col shadow-2xl relative overflow-hidden">
          
          <h2 className="text-[10px] font-black text-slate-500 tracking-[0.2em] mb-4">ACTIVE WORKFLOW SCRIPT</h2>
          
          {/* Script Display */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 mb-6 shadow-inner">
            <p className="text-sm text-blue-100 font-medium leading-relaxed italic">
              {workflowStep === "greeting" && '"Welcome to Elevate Greene! How may I assist you today?"'}
              {workflowStep === "delivery" && '"Please state the carrier name and hold your ID up to the camera lens."'}
              {workflowStep === "resident" && '"Can you please provide the name of the resident you are visiting?"'}
            </p>
          </div>

          {/* Dynamic Decision Tree */}
          <h2 className="text-[10px] font-black text-slate-500 tracking-[0.2em] mb-3">VISITOR RESPONSE</h2>
          
          {workflowStep === "greeting" && (
            <div className="grid grid-cols-2 gap-2 mb-6">
              <button onClick={() => setWorkflowStep("delivery")} className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-3 rounded-xl transition-all border border-slate-700">📦 Delivery / Vendor</button>
              <button onClick={() => setWorkflowStep("resident")} className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-3 rounded-xl transition-all border border-slate-700">👥 Resident Guest</button>
              <button className="bg-rose-900/30 hover:bg-rose-900/50 text-rose-400 text-xs font-bold py-3 rounded-xl transition-all border border-rose-500/30">🚑 Emergency (EMS)</button>
              <button className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-3 rounded-xl transition-all border border-slate-700">🏢 Leasing Office</button>
            </div>
          )}

          {workflowStep === "delivery" && (
            <div className="flex flex-col gap-2 mb-6">
               <button onClick={() => setIdCaptured(true)} className={`text-xs font-bold py-3 rounded-xl transition-all border ${idCaptured ? 'bg-emerald-900/40 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700'}`}>
                 {idCaptured ? '✓ ID IMAGE CAPTURED' : '📸 CAPTURE ID / BADGE'}
               </button>
               <input type="text" placeholder="Enter Carrier (e.g., Amazon, UPS)..." className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500/50 outline-none" />
               <button onClick={() => setWorkflowStep("greeting")} className="text-[10px] text-slate-500 hover:text-white font-bold mt-2 text-left">← BACK TO GREETING</button>
            </div>
          )}

          {workflowStep === "resident" && (
            <div className="flex flex-col gap-2 mb-6">
               <input type="text" placeholder="Search Resident Name or Unit..." className="bg-black/40 border border-emerald-500/50 rounded-xl px-4 py-3 text-sm text-white outline-none mb-2 shadow-[0_0_15px_rgba(16,185,129,0.1)]" />
               <div className="bg-black/30 border border-white/5 rounded-xl p-3 flex justify-between items-center">
                 <div>
                   <div className="text-sm font-bold text-white">Sarah Jenkins (Unit 402)</div>
                 </div>
                 <button className="px-4 py-2 rounded-lg text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all">CALL TENANT</button>
               </div>
               <button onClick={() => setWorkflowStep("greeting")} className="text-[10px] text-slate-500 hover:text-white font-bold mt-2 text-left">← BACK TO GREETING</button>
            </div>
          )}

          {/* Persistent Hardware Controls */}
          <div className="mt-auto pt-4 border-t border-white/10">
            <h2 className="text-[10px] font-black text-slate-500 tracking-[0.2em] mb-3">HARDWARE ACTIONS</h2>
            <button className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-4 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all text-xs tracking-widest border border-emerald-400/50 mb-3">
              🔓 UNLOCK MAIN GATE
            </button>
            <div className="flex gap-2">
              <button className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition-all text-xs">Mute Mic</button>
              <button className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all text-xs shadow-lg">Log & Close</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
