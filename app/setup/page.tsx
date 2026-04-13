"use client";

import React, { useState } from "react";
// Import the service we created to handle the API handshakes
import { eagleEyeService } from "@/services/eagleEyeService";

export default function SetupPage() {
  const [activeConfigMenu, setActiveConfigMenu] = useState("sites"); // Defaulting to sites for this phase

  return (
    <div className="w-full h-full flex flex-col p-8 overflow-y-auto custom-scrollbar relative">
      
      {/* HEADER & AI COMMAND BAR */}
      <div className="flex justify-between items-end mb-8 z-10">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight drop-shadow-md">Infrastructure Hub</h1>
          <p className="text-slate-400 mt-2 font-medium">Manage sites, IoT hardware, and automation logic.</p>
        </div>
        
        {/* Futuristic "Command Palette" Search */}
        <div className="relative w-[400px]">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
             <span className="text-emerald-500 font-bold">⌘</span>
          </div>
          <input 
            type="text" 
            placeholder="Ask AI to configure... (e.g., 'Add Shelly to Main Gate')" 
            className="w-full bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm text-white focus:border-emerald-500/50 outline-none placeholder:text-slate-500 shadow-inner transition-all"
          />
        </div>
      </div>

      {/* DYNAMIC CONFIGURATION WORKSPACE */}
      <div className="flex flex-1 gap-6 z-10 min-h-[600px]">
        
        {/* LEFT: VERTICAL GLASS MENU */}
        <div className="w-64 flex flex-col gap-3 shrink-0">
           {[
             { id: "sites", icon: "🏢", label: "Sites & Zones", desc: "Manage properties" },
             { id: "hardware", icon: "🔌", label: "Device Topology", desc: "Cameras, Shelly, Brivo" },
             { id: "logic", icon: "🧠", label: "Logic Engine", desc: "Automations & SOPs" },
             { id: "infra", icon: "☁️", label: "Edge & Cloud", desc: "Server architecture" },
             { id: "users", icon: "👥", label: "Team & Roles", desc: "Operators & Access" },
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
          
          {/* Subtle Grid Background */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

          {/* VIEW: SITES (FUNCTIONAL VERSION) */}
          {activeConfigMenu === "sites" && (
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-black text-white tracking-widest uppercase">Active Sites</h2>
                <button className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-6 rounded-xl transition-all shadow-lg shadow-emerald-500/20 text-sm">
                  + Provision New Site
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Site Portfolio List: 
                  Ensure 'name' matches your siteName in Vercel's NEXT_PUBLIC_SITE_CONFIG exactly.
                */}
                {[
                  { name: "Marbella Place", id: "SITE-8259", cams: 12, brivo: 2, status: "Online" },
                  { name: "Elevate Eagles Landing", id: "SITE-8260", cams: 8, brivo: 1, status: "Syncing" },
                  { name: "Elevate Greene", id: "SITE-8261", cams: 14, brivo: 3, status: "Online" }
                ].map((site) => (
                  <div key={site.name} className="bg-white/5 border border-white/10 p-5 rounded-2xl hover:border-emerald-500/50 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">{site.name}</h3>
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest">Property ID: {site.id}</span>
                      </div>
                      
                      {/* SITE AUTHORIZATION TRIGGER */}
                      <button 
                        onClick={() => eagleEyeService.login(site.name)}
                        className="bg-emerald-500/20 text-emerald-400 text-[10px] font-black px-4 py-2 rounded-xl border border-emerald-500/30 hover:bg-emerald-500 hover:text-white transition-all shadow-lg shadow-emerald-500/10"
                      >
                        CONNECT API
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs font-mono text-slate-400 mb-4">
                      <div className="bg-black/50 p-2 rounded-lg text-center"><span className="text-white font-bold text-sm block">{site.cams}</span>Cameras</div>
                      <div className="bg-black/50 p-2 rounded-lg text-center"><span className="text-white font-bold text-sm block">--</span>Shellys</div>
                      <div className="bg-black/50 p-2 rounded-lg text-center"><span className="text-white font-bold text-sm block">{site.brivo}</span>Brivo</div>
                    </div>

                    <div className="text-[10px] text-slate-500 uppercase tracking-widest flex justify-between border-t border-white/10 pt-3">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full animate-pulse ${site.status === "Online" ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                        Edge: {site.status}
                      </span>
                      <span className="text-slate-600">Eagle Eye v3.0</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW: HARDWARE TOPOLOGY */}
          {activeConfigMenu === "hardware" && (
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-black text-white tracking-widest uppercase">Hardware Topology <span className="text-slate-500 text-sm ml-2">Elevate Greene</span></h2>
                <div className="flex gap-2">
                  <button className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-4 rounded-xl transition-all text-sm">+ Add Device</button>
                  <button className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-4 rounded-xl transition-all text-sm">Sync Brivo</button>
                </div>
              </div>

              <div className="flex-1 border border-white/5 rounded-2xl bg-black/60 relative flex items-center justify-center p-8 overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20">
                  <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-[0_0_30px_rgba(99,102,241,0.4)] flex items-center justify-center border border-indigo-400/50 mb-3">
                    <span className="text-3xl">☁️</span>
                  </div>
                  <span className="text-xs font-bold text-white tracking-widest">GATEGUARD EDGE</span>
                  <span className="text-[10px] text-emerald-400 font-mono">192.168.1.100</span>
                </div>

                <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                  <path d="M 50% 50% L 20% 30%" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeDasharray="5,5" />
                  <path d="M 50% 50% L 80% 30%" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeDasharray="5,5" />
                  <path d="M 50% 50% L 50% 80%" stroke="rgba(16,185,129,0.5)" strokeWidth="2" />
                </svg>

                <div className="absolute top-[20%] left-[15%] flex flex-col items-center z-20 cursor-pointer group">
                  <div className="w-14 h-14 bg-slate-800 rounded-full border-2 border-slate-600 group-hover:border-blue-400 flex items-center justify-center mb-2 transition-all">📷</div>
                  <span className="text-xs text-white font-bold">Main Gate Cam</span>
                  <span className="text-[9px] text-slate-500">Eagle Eye</span>
                </div>

                <div className="absolute top-[20%] right-[15%] flex flex-col items-center z-20 cursor-pointer group">
                  <div className="w-14 h-14 bg-slate-800 rounded-full border-2 border-slate-600 group-hover:border-amber-400 flex items-center justify-center mb-2 transition-all">🔌</div>
                  <span className="text-xs text-white font-bold">Gate Relay</span>
                  <span className="text-[9px] text-amber-500">Shelly Pro 1</span>
                </div>

                <div className="absolute bottom-[10%] left-[45%] flex flex-col items-center z-20 cursor-pointer group">
                  <div className="w-14 h-14 bg-slate-800 rounded-full border-2 border-emerald-500 flex items-center justify-center mb-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)]">🚪</div>
                  <span className="text-xs text-white font-bold">Entrance Door</span>
                  <span className="text-[9px] text-emerald-500">Brivo ACS</span>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: LOGIC ENGINE */}
          {activeConfigMenu === "logic" && (
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-black text-white tracking-widest uppercase">Logic Engine <span className="text-emerald-500 text-sm ml-2">Automations</span></h2>
                <button className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-6 rounded-xl transition-all shadow-lg text-sm">
                  + Create Workflow
                </button>
              </div>
              
              <div className="flex-1 bg-black/40 border border-white/10 rounded-2xl p-6 flex flex-col gap-6 overflow-y-auto">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Auto-Open Emergency Vehicles</h3>
                    <div className="w-10 h-5 bg-emerald-500 rounded-full flex items-center p-0.5 cursor-pointer">
                      <div className="w-4 h-4 bg-white rounded-full translate-x-5 shadow-sm"></div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    <div className="bg-indigo-500/20 border border-indigo-500/50 text-indigo-300 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap">
                      ⚡ IF: AI Detects EMS Vehicle
                    </div>
                    <span className="text-slate-600 font-bold">→</span>
                    <div className="bg-amber-500/20 border border-amber-500/50 text-amber-300 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap">
                      ⚙️ AND: Confidence {">"} 90%
                    </div>
                    <span className="text-slate-600 font-bold">→</span>
                    <div className="bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap">
                      🟢 THEN: Trigger Shelly Relay 1
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Fallback for other tabs */}
          {["infra", "users"].includes(activeConfigMenu) && (
            <div className="relative z-10 flex h-full items-center justify-center">
               <div className="text-center">
                 <span className="text-4xl block mb-4">🏗️</span>
                 <h2 className="text-xl font-bold text-white mb-2">{activeConfigMenu.toUpperCase()} MODULE</h2>
                 <p className="text-slate-400">This workspace is currently under construction.</p>
               </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
