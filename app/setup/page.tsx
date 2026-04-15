"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { eagleEyeService } from "@/services/eagleEyeService";

export default function SetupPage() {
  const [activeConfigMenu, setActiveConfigMenu] = useState("sites");
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // SOC Gatekeeper State
  const [configuringSiteId, setConfiguringSiteId] = useState<string | null>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  
  const [formData, setFormData] = useState({
    een_location_id: '',
    een_tag: '',
    is_monitored: false,
    timezone: 'America/New_York',
    schedule_start: '18:00',
    schedule_end: '06:00'
  });

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

  // Phase 2: Location Discovery
  const handleOpenConfig = async (site: any) => {
    setConfiguringSiteId(site.id);
    setFormData({
      een_location_id: site.een_location_id || '',
      een_tag: site.een_tag || '',
      is_monitored: site.is_monitored || false,
      timezone: site.timezone || 'America/New_York',
      schedule_start: site.schedule_start || '18:00',
      schedule_end: site.schedule_end || '06:00'
    });

    setLoadingLocations(true);
    try {
      const res = await fetch('/api/een/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: site.id })
      });
      const data = await res.json();
      if (data.success) {
        setLocations(data.locations);
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      console.error("Fetch locations error:", err);
      alert("Failed to fetch EEN locations. Check console.");
    }
    setLoadingLocations(false);
  };

  // Phase 4 & 5: Lock config to DB and Sync Cameras
  const handleSaveAndHarvest = async (siteId: string) => {
    try {
      console.log("💾 Locking Gatekeeper config to Supabase...");
      
      const { error } = await supabase
        .from('sites')
        .update(formData)
        .eq('id', siteId);

      if (error) throw new Error(error.message);

      console.log(`⏳ Starting targeted sync for ${formData.een_tag || 'all cameras'}...`);
      
      // Trigger the backend API route (Now dynamically filtered by Tag!)
      const result = await eagleEyeService.syncHardware(siteId);
      
      console.log("✅ Harvest Complete!", result);
      alert(`✅ Successfully saved config and synced ${result.count} cameras!`);
      
      setConfiguringSiteId(null);
      fetchSites(); // Refresh UI

    } catch (err: any) {
      console.error("❌ Setup Failed:", err.message);
      alert(`Setup failed: ${err.message}.`);
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
        <div className="flex-1 bg-black/40 border border-white/10 rounded-3xl p-6 relative overflow-y-auto">
          {activeConfigMenu === "sites" ? (
            <div className="flex flex-col gap-4">
              {sites.map((site) => (
                <div key={site.id} className="bg-white/5 border border-white/10 p-5 rounded-2xl flex flex-col transition-all">
                  
                  {/* Site Header */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold text-white">{site.name}</h3>
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest">
                        {site.is_monitored ? '🟢 SOC ARMED' : '⚪ UNMONITORED'} | ID: {site.id.slice(0,8)}
                      </span>
                    </div>

                    {site.een_refresh_token ? (
                      <div className="flex items-center gap-3">
                        <div className="bg-emerald-500/20 text-emerald-400 text-[10px] font-black px-3 py-2 rounded-xl border border-emerald-500/50">
                          ✓ API ACTIVE
                        </div>
                        {configuringSiteId !== site.id && (
                          <button 
                            onClick={() => handleOpenConfig(site)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black px-4 py-2 rounded-xl transition-all"
                          >
                            CONFIGURE & SYNC
                          </button>
                        )}
                      </div>
                    ) : (
                      <button 
                        onClick={() => eagleEyeService.login(site.name)}
                        className="bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-black px-4 py-2 rounded-xl transition-all"
                      >
                        CONNECT API
                      </button>
                    )}
                  </div>

                  {/* Inline Configuration Wizard */}
                  {configuringSiteId === site.id && (
                    <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
                      
                      {/* Left Col: Hardware Targeting */}
                      <div className="flex flex-col gap-4">
                        <h4 className="text-xs text-indigo-400 font-black tracking-widest uppercase">1. Hardware Targeting</h4>
                        
                        <div>
                          <label className="block text-[10px] text-slate-400 uppercase tracking-widest mb-1">Sub-Account (Location)</label>
                          <select 
                            value={formData.een_location_id}
                            onChange={(e) => setFormData({...formData, een_location_id: e.target.value})}
                            disabled={loadingLocations}
                            className="w-full bg-black border border-white/20 rounded-lg p-3 text-sm text-white focus:border-indigo-500 outline-none"
                          >
                            <option value="">{loadingLocations ? 'Loading EEN Locations...' : '-- Select Sub-Account --'}</option>
                            {locations.map(loc => (
                              <option key={loc.id} value={loc.id}>{loc.name} ({loc.cameraCount} Cams)</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-400 uppercase tracking-widest mb-1">Property Tag (Filter)</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Marbella"
                            value={formData.een_tag}
                            onChange={(e) => setFormData({...formData, een_tag: e.target.value})}
                            className="w-full bg-black border border-white/20 rounded-lg p-3 text-sm text-white focus:border-indigo-500 outline-none"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Must exactly match the tag used in EEN Dashboard to prevent data bleed.</p>
                        </div>
                      </div>

                      {/* Right Col: SOC Gatekeeper */}
                      <div className="flex flex-col gap-4">
                        <h4 className="text-xs text-emerald-400 font-black tracking-widest uppercase">2. SOC Gatekeeper Schedule</h4>
                        
                        <label className="flex items-center gap-3 cursor-pointer p-3 bg-black/50 border border-white/10 rounded-lg hover:border-white/20 transition-all">
                          <input 
                            type="checkbox" 
                            checked={formData.is_monitored}
                            onChange={(e) => setFormData({...formData, is_monitored: e.target.checked})}
                            className="w-4 h-4 rounded accent-emerald-500 bg-black border-white/30"
                          />
                          <span className="text-sm font-bold text-white">Enable Active SOC Monitoring</span>
                        </label>

                        <div className="grid grid-cols-2 gap-3 opacity-100 transition-opacity" style={{ opacity: formData.is_monitored ? 1 : 0.5 }}>
                          <div className="col-span-2">
                            <label className="block text-[10px] text-slate-400 uppercase tracking-widest mb-1">Timezone</label>
                            <select 
                              value={formData.timezone}
                              onChange={(e) => setFormData({...formData, timezone: e.target.value})}
                              disabled={!formData.is_monitored}
                              className="w-full bg-black border border-white/20 rounded-lg p-3 text-sm text-white focus:border-emerald-500 outline-none disabled:opacity-50"
                            >
                              <option value="America/New_York">Eastern Time (US)</option>
                              <option value="America/Chicago">Central Time (US)</option>
                              <option value="America/Denver">Mountain Time (US)</option>
                              <option value="America/Los_Angeles">Pacific Time (US)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 uppercase tracking-widest mb-1">Arm Time</label>
                            <input 
                              type="time" 
                              value={formData.schedule_start}
                              onChange={(e) => setFormData({...formData, schedule_start: e.target.value})}
                              disabled={!formData.is_monitored}
                              className="w-full bg-black border border-white/20 rounded-lg p-3 text-sm text-white focus:border-emerald-500 outline-none disabled:opacity-50 [color-scheme:dark]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 uppercase tracking-widest mb-1">Disarm Time</label>
                            <input 
                              type="time" 
                              value={formData.schedule_end}
                              onChange={(e) => setFormData({...formData, schedule_end: e.target.value})}
                              disabled={!formData.is_monitored}
                              className="w-full bg-black border border-white/20 rounded-lg p-3 text-sm text-white focus:border-emerald-500 outline-none disabled:opacity-50 [color-scheme:dark]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="col-span-2 flex justify-end gap-3 mt-2 border-t border-white/10 pt-4">
                        <button 
                          onClick={() => setConfiguringSiteId(null)}
                          className="px-6 py-3 rounded-xl border border-white/20 text-white text-xs font-bold hover:bg-white/5 transition-all"
                        >
                          CANCEL
                        </button>
                        <button 
                          onClick={() => handleSaveAndHarvest(site.id)}
                          className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black tracking-widest transition-all"
                        >
                          SAVE CONFIG & HARVEST CAMERAS
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-500 uppercase tracking-widest font-bold">
              Select a module from the left
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
