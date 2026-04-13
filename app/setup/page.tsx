"use client";

import React, { useState, useEffect } from "react";
import { eagleEyeService } from "@/services/eagleEyeService";

export default function SetupPage() {
  const [activeConfigMenu, setActiveConfigMenu] = useState("sites");
  
  // 1. Initialize state with the EXACT names used in your Vercel NEXT_PUBLIC_SITE_CONFIG
  const [siteData, setSiteData] = useState<any>({
    "Pegasus Properties - Marbella Place": { status: "Offline", cams: "--", connected: false, id: "SITE-8259" },
    "Elevate Eagles Landing": { status: "Offline", cams: "--", connected: false, id: "SITE-8260" },
    "Elevate Greene": { status: "Offline", cams: "--", connected: false, id: "SITE-8261" }
  });

  // 2. Logic to check for active tokens and pull live camera counts
  useEffect(() => {
    const checkConnections = async () => {
      const updatedSites = { ...siteData };
      let hasChanges = false;

      for (const siteName of Object.keys(siteData)) {
        const token = localStorage.getItem(`een_token_${siteName}`);
        
        if (token) {
          try {
            // This calls the method we just added to eagleEyeService
            const cameras = await eagleEyeService.getCameras(token, siteName);
            
            updatedSites[siteName] = {
              ...updatedSites[siteName],
              status: "Online",
              cams: Array.isArray(cameras) ? cameras.length : 0,
              connected: true
            };
            hasChanges = true;
          } catch (err) {
            console.error(`Token expired or invalid for ${siteName}:`, err);
            localStorage.removeItem(`een_token_${siteName}`);
          }
        }
      }
      if (hasChanges) setSiteData(updatedSites);
    };

    checkConnections();
  }, []);

  return (
    <div className="w-full h-full flex flex-col p-8 overflow-y-auto custom-scrollbar relative">
      
      {/* HEADER & AI COMMAND BAR */}
      <div className="flex justify-between items-end mb-8 z-10">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight drop-shadow-md">Infrastructure Hub</h1>
          <p className="text-slate-400 mt-2 font-medium">Manage sites, IoT hardware, and automation logic.</p>
        </div>
        
        <div className="relative w-[400px]">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
             <span className="text-emerald-500 font-bold">⌘</span>
          </div>
          <input 
            type="text" 
            placeholder="Ask AI to configure... (e.g., 'Add Marbella Gate Cam')" 
            className="w-full bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm text-white focus:border-emerald-500/50 outline-none placeholder:text-slate-500 shadow-inner transition-all"
          />
        </div>
      </div>

      <div className="flex flex-1 gap-6 z-10 min-h-[600px]">
        
        {/* LEFT: VERTICAL MENU */}
        <div className="w-64 flex flex-col gap-3 shrink-0">
           {[
             { id: "sites", icon: "🏢", label: "Sites & Zones", desc: "Manage properties" },
             { id: "hardware", icon: "🔌", label: "Device Topology", desc: "Cameras, Shelly, Brivo" },
             { id: "logic", icon: "🧠", label: "Logic Engine", desc: "Automations & SOPs" },
           ].map((item) => (
             <button 
               key={item.id}
               onClick={() => setActiveConfigMenu(item.id)}
               className={`flex flex-col items-start text-left p-4 rounded-2xl transition-all border ${
                 activeConfigMenu === item.id 
                 ? "bg-gradient-to-br from-white/10 to-white/5 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)]" 
                 : "bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/10"
               }`}
             >
               <div className="flex items-center space-x-3 mb-1">
                 <span className="text-xl">{item.icon}</span>
                 <span className={`font-bold ${activeConfigMenu === item.id ? 'text-emerald-400' : 'text-slate-200'}`}>{item.label}</span>
               </div>
               <span className="text-[10px] text-slate-500 ml-8 uppercase tracking-widest">{item.desc}</span>
             </button>
           ))}
        </div>

        {/* RIGHT: CONFIGURATION CANVAS */}
        <div className="flex-1 bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

          {/* VIEW: SITES */}
          {activeConfigMenu === "sites" && (
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-black text-white tracking-widest uppercase">Active Site Portfolio</h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {Object.keys(siteData).map((name) => (
                  <div key={name} className="bg-white/5 border border-white/10 p-5 rounded-2xl hover:border-emerald-500/50 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="max-w-[180px]">
                        <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors leading-tight">{name}</h3>
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest">{siteData[name].id}</span>
                      </div>
                      
                      {/* AUTH BUTTON: Switches to checkmark if connected */}
                      {siteData[name].connected ? (
                        <div className="bg-emerald-500/20 text-emerald-400 text-[9px] font-black px-3 py-2 rounded-xl border border-emerald-500/50 flex items-center gap-2">
                          ✓ API ACTIVE
                        </div>
                      ) : (
                        <button 
                          onClick={() => eagleEyeService.login(name)}
                          className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black px-4 py-2 rounded-xl border border-emerald-500/30 hover:bg-emerald-500 hover:text-white transition-all shadow-lg"
                        >
                          CONNECT API
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs font-mono text-slate-400 mb-4">
                      <div className="bg-black/50 p-2 rounded-lg text-center">
                        <span className="text-white font-bold text-sm block">{siteData[name].cams}</span>Cameras
                      </div>
                      <div className="bg-black/50 p-2 rounded-lg text-center">
                        <span className="text-white font-bold text-sm block">--</span>Shellys
                      </div>
                      <div className="bg-black/50 p-2 rounded-lg text-center">
                        <span className="text-white font-bold text-sm block">--</span>Brivo
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-500 uppercase tracking-widest flex justify-between border-t border-white/10 pt-3">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${siteData[name].connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`}></span>
                        Status: {siteData[name].status}
                      </span>
                      <span className="text-slate-600">V3.0 HANDSHAKE</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW: HARDWARE (Placeholder) */}
          {activeConfigMenu === "hardware" && (
             <div className="relative z-10 flex h-full items-center justify-center text-slate-500 text-[10px] font-black tracking-[0.3em]">
               TOPOLOGY MAP INITIALIZING...
             </div>
          )}

        </div>
      </div>
    </div>
  );
}
