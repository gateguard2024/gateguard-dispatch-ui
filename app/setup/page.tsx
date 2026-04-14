"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { eagleEyeService } from "@/services/eagleEyeService";
import { Activity, Plus, Network, Brain, ShieldCheck, Loader2 } from "lucide-react";

export default function SetupPage() {
  const [activeConfigMenu, setActiveConfigMenu] = useState("sites");
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ============================================================================
  // 1. DYNAMIC DATA FETCH (The "Source of Truth")
  // ============================================================================
  const fetchSites = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sites')
      .select(`
        *,
        cameras (count)
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSites(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSites();
  }, []);

  // ============================================================================
  // 2. PROVISIONING WIZARD STATE
  // ============================================================================
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [siteName, setSiteName] = useState("");
  // Note: We don't manualy input EEN tokens here anymore; we use the OAuth Handshake.

  return (
    <div className="w-full h-full flex flex-col p-8 overflow-y-auto custom-scrollbar relative">
      
      {/* HEADER */}
      <div className="flex justify-between items-end mb-8 z-10">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">Infrastructure Hub</h1>
          <p className="text-slate-400 mt-2 font-medium">Manage sites, IoT hardware, and automation logic.</p>
        </div>
      </div>

      <div className="flex flex-1 gap-6 z-10 min-h-[600px]">
        
        {/* LEFT MENU */}
        <div className="w-64 flex flex-col gap-3 shrink-0">
          {[
            { id: "sites", icon: <Activity size={18}/>, label: "Sites & Zones", desc: "Manage properties" },
            { id: "new-site", icon: <Plus size={18}/>, label: "Provision Site", desc: "Add new property" },
            { id: "hardware", icon: <Network size={18}/>, label: "Device Topology", desc: "Topology Map" },
            { id: "logic", icon: <Brain size={18}/>, label: "Logic Engine", desc: "Automations" },
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
                <span className={activeConfigMenu === item.id ? 'text-emerald-400' : 'text-slate-400'}>{item.icon}</span>
                <span className={`font-bold ${activeConfigMenu === item.id ? 'text-emerald-400' : 'text-slate-200'}`}>{item.label}</span>
              </div>
              <span className="text-[10px] text-slate-500 ml-8 uppercase tracking-widest">{item.desc}</span>
            </button>
          ))}
        </div>

        {/* RIGHT CANVAS */}
        <div className="flex-1 bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

          {activeConfigMenu === "sites" && (
            <div className="relative z-10 flex flex-col h-full animate-in fade-in duration-300">
              <h2 className="text-lg font-black text-white tracking-widest uppercase mb-6">Active Site Portfolio</h2>
              
              {loading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="text-emerald-500 animate-spin" size={40} />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {sites.map((site) => (
                    <div 
                      key={site.id} 
                      className="bg-white/5 border border-white/10 p-5 rounded-2xl hover:border-emerald-500/50 transition-all group relative overflow-hidden"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="max-w-[180px]">
                          <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors leading-tight">{site.name}</h3>
                          <span className="text-[10px] text-slate-500 uppercase tracking-widest">ID: {site.id.slice(0,8)}</span>
                        </div>

                        {/* AUTH BUTTON - Check for real refresh token */}
                        {site.een_refresh_token ? (
                          <div className="bg-emerald-500/20 text-emerald-400 text-[9px] font-black px-3 py-2 rounded-xl border border-emerald-500/50 flex items-center gap-2">
                             <ShieldCheck size={12} /> API ACTIVE
                          </div>
                        ) : (
                          <button 
                            onClick={() => eagleEyeService.login(site.name)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black px-4 py-2 rounded-xl transition-all shadow-lg shadow-indigo-500/20"
                          >
                            CONNECT API
                          </button>
                        )}
                      </div>

                      {/* STATS FROM DB */}
                      <div className="grid grid-cols-3 gap-2 text-xs font-mono text-slate-400 mb-4">
                        <div className="bg-black/50 p-2 rounded-lg text-center">
                          <span className="text-white font-bold text-sm block">{site.cameras?.[0]?.count || 0}</span>Cameras
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
                          <span className={`w-2 h-2 rounded-full ${site.een_refresh_token ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                          {site.een_refresh_token ? 'Online' : 'Needs Auth'}
                        </span>
                        <span className="text-slate-600">V3.0 HANDSHAKE</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ADD NEW SITE (Minimal for SQL Flow) */}
          {activeConfigMenu === "new-site" && (
            <div className="relative z-10 flex flex-col h-full items-center justify-center">
               <Plus className="text-emerald-500 mb-4" size={48} />
               <h2 className="text-white font-bold text-xl mb-2">Manual Provisioning Overridden</h2>
               <p className="text-slate-400 text-center max-w-md">
                 Use the SQL Launch script to establish the site record first, then use the <b>Connect API</b> button on the Portfolio tab to link Eagle Eye.
               </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
