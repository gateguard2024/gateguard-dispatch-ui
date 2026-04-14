"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { eagleEyeService } from "@/services/eagleEyeService";

export default function SetupPage() {
  const [activeConfigMenu, setActiveConfigMenu] = useState("sites");
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSites = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sites')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) setSites(data);
    setLoading(false);
  };

  useEffect(() => { fetchSites(); }, []);

  // NEW: The Hardware Sync Function
  const handleSyncCameras = async (siteName: string) => {
    try {
      console.log(`⏳ Starting sync for ${siteName}...`);
      
      // Look up the internal Site ID
      const { data: site, error } = await supabase
        .from('sites')
        .select('id')
        .eq('name', siteName)
        .single();

      if (error || !site) throw new Error("Could not find Site ID in database");

      // Trigger the backend API route
      const result = await eagleEyeService.syncHardware(site.id);
      
      console.log("✅ Sync Complete!", result);
      alert(`✅ Successfully synced ${result.count} cameras! Check console for details.`);

    } catch (err: any) {
      console.error("❌ Sync Failed:", err.message);
      alert(`Sync failed: ${err.message}. Check the console.`);
    }
  };

  return (
    <div className="w-full h-full flex flex-col p-8 overflow-y-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">Infrastructure Hub</h1>
          <p className="text-slate-400 mt-2 font-medium">Manage sites and automation logic.</p>
        </div>
      </div>

      <div className="flex flex-1 gap-6">
        {/* LEFT MENU */}
        <div className="w-64 flex flex-col gap-3">
          {[{ id: "sites", icon: "🏢", label: "Sites & Zones" },
            { id: "new-site", icon: "✨", label: "Provision Site" }].map((item) => (
            <button 
              key={item.id}
              onClick={() => setActiveConfigMenu(item.id)}
              className={`p-4 rounded-2xl border text-left transition-all ${
                activeConfigMenu === item.id ? "bg-white/10 border-emerald-500/50" : "bg-white/5 border-white/5"
              }`}
            >
              <span className="text-xl mr-3">{item.icon}</span>
              <span className="font-bold text-white">{item.label}</span>
            </button>
          ))}
        </div>

        {/* RIGHT CANVAS */}
        <div className="flex-1 bg-black/40 border border-white/10 rounded-3xl p-6 relative">
          {activeConfigMenu === "sites" ? (
            <div className="grid grid-cols-2 gap-4">
              {sites.map((site) => (
                <div key={site.id} className="bg-white/5 border border-white/10 p-5 rounded-2xl">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white">{site.name}</h3>
                      <span className="text-[10px] text-slate-500 uppercase">ID: {site.id.slice(0,8)}</span>
                    </div>

                    {/* NEW: Updated Button Logic */}
                    {site.een_refresh_token ? (
                      <div className="flex flex-col items-end gap-2">
                        <div className="bg-emerald-500/20 text-emerald-400 text-[9px] font-black px-3 py-2 rounded-xl border border-emerald-500/50">
                          ✓ API ACTIVE
                        </div>
                        {/* The Sync Button Appears Once API is Active */}
                        <button 
                          onClick={() => handleSyncCameras(site.name)}
                          className="bg-green-600 hover:bg-green-500 text-white text-[10px] font-black px-4 py-2 rounded-xl transition-all"
                        >
                          SYNC CAMERAS
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => eagleEyeService.login(site.name)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black px-4 py-2 rounded-xl transition-all"
                      >
                        CONNECT API
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-500 uppercase tracking-widest">
              Select a module from the left
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
