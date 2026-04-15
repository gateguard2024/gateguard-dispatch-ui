"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { eagleEyeService } from "@/services/eagleEyeService";

export default function SetupPage() {
  const [activeConfigMenu, setActiveConfigMenu] = useState("accounts");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [zoneCameras, setZoneCameras] = useState<{ [key: string]: any[] }>({});
  const [loading, setLoading] = useState(true);

  // Auto-Discovery State
  const [scanLocationId, setScanLocationId] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanningAccountId, setScanningAccountId] = useState<string | null>(null);

  // Zone Settings State
  const [configuringZoneId, setConfiguringZoneId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data: accts } = await supabase.from('accounts').select('*').order('created_at', { ascending: false });
    const { data: zns } = await supabase.from('zones').select('*').order('name', { ascending: true });
    
    if (accts) setAccounts(accts);
    if (zns) setZones(zns);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const fetchZoneCameras = async (zoneId: string) => {
    const { data } = await supabase.from('cameras').select('*').eq('zone_id', zoneId).order('name', { ascending: true });
    if (data) {
      setZoneCameras(prev => ({ ...prev, [zoneId]: data }));
    }
  };

  // ==========================================
  // THE AUTO-DISCOVERY ENGINE
  // ==========================================
  const handleScanAndGenerateZones = async (accountId: string) => {
    if (!scanLocationId) return alert("Please enter the Sub-Account ID (Location ID) from EEN.");
    
    setIsScanning(true);
    try {
      // 1. Fetch tags from the official EEN API
      const res = await fetch('/api/een/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: accountId }) // We pass siteId so the old route doesn't break
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      // 2. Generate the Composite IDs and prep the rows
      const tags: string[] = data.tags;
      const baseId = `2026-${scanLocationId}`;
      
      const newZones = tags.map(tag => {
        const safeTag = tag.toLowerCase().replace(/[^a-z0-9]/g, '-');
        return {
          id: `${baseId}-${safeTag}`,
          account_id: accountId,
          name: tag,
          een_tag: tag,
          is_monitored: false
        };
      });

      // Add a fallback zone for cameras with NO tags
      newZones.push({
        id: `${baseId}-root`,
        account_id: accountId,
        name: "All Root Cameras (Untagged)",
        een_tag: "",
        is_monitored: false
      });

      // 3. Bulk insert to Supabase
      const { error } = await supabase.from('zones').upsert(newZones, { onConflict: 'id' });
      if (error) throw new Error(error.message);

      alert(`✅ Discovery Complete! Generated ${newZones.length} Property Zones.`);
      setScanLocationId("");
      setScanningAccountId(null);
      fetchData();

    } catch (err: any) {
      alert(`Scan failed: ${err.message}`);
    }
    setIsScanning(false);
  };

  const handleHarvestCameras = async (zoneId: string) => {
    try {
      console.log(`⏳ Starting sync for Zone ${zoneId}...`);
      
      const res = await fetch('/api/een/sync-hardware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zoneId })
      });
      const result = await res.json();

      if (!result.success) throw new Error(result.error);
      
      alert(`✅ ${result.message}`);
      fetchZoneCameras(zoneId); 

    } catch (err: any) {
      alert(`Harvest failed: ${err.message}`);
    }
  };

  const toggleCameraMonitor = async (cameraId: string, currentStatus: boolean, zoneId: string) => {
    // Optimistic UI update
    setZoneCameras(prev => ({
      ...prev,
      [zoneId]: prev[zoneId].map(c => c.id === cameraId ? { ...c, is_monitored: !currentStatus } : c)
    }));
    await supabase.from('cameras').update({ is_monitored: !currentStatus }).eq('id', cameraId);
  };

  const updateZoneSettings = async (zoneId: string, updates: any) => {
    await supabase.from('zones').update(updates).eq('id', zoneId);
    fetchData(); // Refresh UI
  };

  return (
    <div className="w-full h-full flex flex-col p-8 overflow-y-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">Infrastructure Hub</h1>
          <p className="text-slate-400 mt-2 font-medium">Auto-Discover properties and manage Gatekeeper logic.</p>
        </div>
      </div>

      <div className="flex flex-1 gap-6">
        {/* LEFT MENU */}
        <div className="w-64 flex flex-col gap-3">
          <button 
            onClick={() => setActiveConfigMenu("accounts")}
            className={`p-4 rounded-2xl border text-left transition-all ${
              activeConfigMenu === "accounts" ? "bg-white/10 border-indigo-500/50" : "bg-white/5 border-white/5"
            }`}
          >
            <span className="text-xl mr-3">🏢</span>
            <span className="font-bold text-white">Master Accounts</span>
          </button>
        </div>

        {/* RIGHT CANVAS */}
        <div className="flex-1 bg-black/40 border border-white/10 rounded-3xl p-6 relative overflow-y-auto">
          {activeConfigMenu === "accounts" && (
            <div className="flex flex-col gap-8">
              
              {/* MASTER ACCOUNTS LIST */}
              {accounts.map((account) => (
                <div key={account.id} className="flex flex-col gap-4">
                  
                  {/* Account Header */}
                  <div className="bg-indigo-900/20 border border-indigo-500/30 p-5 rounded-2xl flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xl font-black text-indigo-400">{account.name} (Master Account)</h3>
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest">ID: {account.id.slice(0,8)}</span>
                      </div>

                      {!account.een_refresh_token ? (
                        <button 
                          onClick={() => eagleEyeService.login(account.name)} // Might need to pass account.id depending on your login logic
                          className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black px-4 py-2 rounded-xl transition-all"
                        >
                          CONNECT EEN API
                        </button>
                      ) : (
                        <div className="bg-emerald-500/20 text-emerald-400 text-[10px] font-black px-3 py-2 rounded-xl border border-emerald-500/50">
                          ✓ API CONNECTED
                        </div>
                      )}
                    </div>

                    {/* Auto-Discovery Bar */}
                    {account.een_refresh_token && (
                      <div className="flex gap-3 bg-black/50 p-3 rounded-xl border border-white/10">
                        <input 
                          type="text" 
                          placeholder="Paste Sub-Account ID (e.g. 100bd80b) to Scan..."
                          value={scanningAccountId === account.id ? scanLocationId : ''}
                          onChange={(e) => {
                            setScanningAccountId(account.id);
                            setScanLocationId(e.target.value);
                          }}
                          className="flex-1 bg-transparent text-sm text-white focus:outline-none px-2 font-mono"
                        />
                        <button 
                          onClick={() => handleScanAndGenerateZones(account.id)}
                          disabled={isScanning || scanningAccountId !== account.id}
                          className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                        >
                          {isScanning && scanningAccountId === account.id ? 'SCANNING...' : 'SCAN & AUTO-GENERATE ZONES'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* GENERATED ZONES GRID */}
                  <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-white/5">
                    {zones.filter(z => z.account_id === account.id).map(zone => (
                      <div key={zone.id} className="bg-white/5 border border-white/10 p-4 rounded-xl flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="text-white font-bold">{zone.name}</h4>
                            <p className="text-[10px] text-slate-500 font-mono mt-1">{zone.id}</p>
                          </div>
                          <span className={`text-[9px] font-black px-2 py-1 rounded border ${zone.is_monitored ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-white/5 text-slate-500 border-white/10'}`}>
                            {zone.is_monitored ? 'SOC ARMED' : 'UNMONITORED'}
                          </span>
                        </div>

                        {/* Zone Quick Actions */}
                        <div className="flex gap-2 border-t border-white/10 pt-3">
                          <button 
                            onClick={() => {
                              setConfiguringZoneId(zone.id === configuringZoneId ? null : zone.id);
                              if (zone.id !== configuringZoneId && !zoneCameras[zone.id]) fetchZoneCameras(zone.id);
                            }}
                            className="flex-1 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold py-2 rounded-lg transition-all"
                          >
                            {configuringZoneId === zone.id ? 'CLOSE SETTINGS' : 'SETTINGS & PRUNING'}
                          </button>
                          <button 
                            onClick={() => handleHarvestCameras(zone.id)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-4 py-2 rounded-lg transition-all"
                          >
                            HARVEST CAMS
                          </button>
                        </div>

                        {/* Expanding Settings Panel */}
                        {configuringZoneId === zone.id && (
                          <div className="mt-2 pt-4 border-t border-white/10 animate-in slide-in-from-top-2 duration-200">
                            <label className="flex items-center gap-3 cursor-pointer p-3 bg-black/40 rounded-lg hover:bg-black/60 transition-all mb-4">
                              <input 
                                type="checkbox" 
                                checked={zone.is_monitored}
                                onChange={(e) => updateZoneSettings(zone.id, { is_monitored: e.target.checked })}
                                className="w-4 h-4 rounded accent-emerald-500"
                              />
                              <span className="text-xs font-bold text-white">Enable Master Monitoring</span>
                            </label>

                            {/* Camera Pruning List */}
                            {zoneCameras[zone.id] && zoneCameras[zone.id].length > 0 && (
                              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Hardware Nodes ({zoneCameras[zone.id].length})</span>
                                {zoneCameras[zone.id].map((cam: any) => (
                                  <div key={cam.id} className="flex justify-between items-center bg-black/30 p-2 rounded border border-white/5">
                                    <span className="text-[11px] text-slate-300 truncate pr-2">{cam.name}</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input type="checkbox" className="sr-only peer" checked={cam.is_monitored} onChange={() => toggleCameraMonitor(cam.id, cam.is_monitored, zone.id)} />
                                      <div className="w-7 h-4 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                                    </label>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
