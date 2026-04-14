"use client";

import React, { useState, useEffect } from "react";
import { eagleEyeService } from "@/services/eagleEyeService";

// ============================================================================
// 📍 HARDWARE MAPPING: Map your Bridge ESNs to your Sites here.
// You can add multiple bridges per site like: ["1003476d", "1004abcd"]
// ============================================================================
const SITE_BRIDGES: Record<string, string[]> = {
  "Pegasus Properties - Marbella Place": ["10071c5d"], // The ESN from your screenshot!
  "Elevate Eagles Landing": [], // Add Eagles Landing ESNs here later
  "Elevate Greene": []          // Add Greene ESNs here later
};

export default function SetupPage() {
  const [activeConfigMenu, setActiveConfigMenu] = useState("sites");
  
  // ============================================================================
  // 1. EXISTING DASHBOARD STATE
  // ============================================================================
  const [siteData, setSiteData] = useState<any>({
    "Pegasus Properties - Marbella Place": { status: "Offline", cams: "--", connected: false, id: "SITE-8259" },
    "Elevate Eagles Landing": { status: "Offline", cams: "--", connected: false, id: "SITE-8260" },
    "Elevate Greene": { status: "Offline", cams: "--", connected: false, id: "SITE-8261" }
  });

  // ============================================================================
  // 2. NEW WIZARD STATE
  // ============================================================================
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [siteName, setSiteName] = useState("");
  const [eenToken, setEenToken] = useState("");
  const [discoveredCameras, setDiscoveredCameras] = useState<any[]>([]);
  const [selectedCameras, setSelectedCameras] = useState<string[]>([]);
  const [sopSteps, setSopSteps] = useState<string[]>(["Confirm visual via live feed", "Check for authorized Brivo credential"]);
  const [newSopStep, setNewSopStep] = useState("");

  // ============================================================================
  // 3. EXISTING DASHBOARD LOGIC (UNTOUCHED)
  // Logic to check for active tokens and pull live camera counts
  // ============================================================================
  useEffect(() => {
    const checkConnections = async () => {
      const updatedSites = { ...siteData };
      let hasChanges = false;

      for (const siteName of Object.keys(siteData)) {
        const token = localStorage.getItem(`een_token_${siteName}`);
        
        if (token) {
          try {
            console.log(`Checking cameras for ${siteName} via PROXY...`);
            
            const response = await fetch('/api/een/cameras', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token, siteName })
            });

            if (!response.ok) throw new Error(`Proxy error: ${response.status}`);

            const cameras = await response.json();
            const allCameras = cameras.results || [];
            
            // Extract keyword for Direct-to-Cloud fallback (e.g., "Marbella Place")
            const siteKeyword = siteName.includes(" - ") 
              ? siteName.split(" - ")[1].trim().toLowerCase() 
              : siteName.toLowerCase();

            // Get the allowed Bridge ESNs for this specific site
            const allowedBridges = SITE_BRIDGES[siteName] || [];

            // --- THE HYBRID FILTER ---
            const siteCameras = allCameras.filter((cam: any) => {
              const camName = (cam.name || "").toLowerCase();
              const bridgeId = cam.bridgeId || "";
              
              // Condition 1: Does the camera live on an approved Bridge?
              const isOnApprovedBridge = allowedBridges.includes(bridgeId);
              
              // Condition 2: Is it a Direct-to-Cloud camera with the site name?
              const isDirectToCloudMatch = camName.includes(siteKeyword);

              // If either is true, this camera belongs to this site!
              return isOnApprovedBridge || isDirectToCloudMatch;
            });

            console.log(`✅ ${siteName} filtered to ${siteCameras.length} cameras.`);
            
            updatedSites[siteName] = {
              ...updatedSites[siteName],
              status: "Online",
              cams: siteCameras.length, 
              connected: true
            };
            hasChanges = true;
          } catch (err) {
            console.error(`Error for ${siteName}:`, err);
          }
        }
      }
      if (hasChanges) setSiteData(updatedSites);
    };

    checkConnections();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================================
  // 4. NEW WIZARD LOGIC (Hitting the working API)
  // ============================================================================
  const handleDiscoverCameras = async () => {
    if (!eenToken) return alert("Please enter an Eagle Eye Token");
    if (!siteName) return alert("Please enter a Site Name in Step 1");
    
    setIsSaving(true); // Show loading state

    try {
      console.log(`Discovering cameras for new site: ${siteName}...`);
      
      // Hit your PROVEN, working Vercel proxy!
      const response = await fetch('/api/een/cameras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: eenToken, siteName: siteName })
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);

      const data = await response.json();
      const allCameras = data.results || [];
      
      if (allCameras.length === 0) {
          alert("Connected successfully, but 0 cameras were found for this token.");
          setIsSaving(false);
          return;
      }

      // Format the raw EEN data into our clean {id, name} UI structure
      const realCameras = allCameras.map((cam: any) => ({
        id: cam.camera_id || cam.id || cam.esn || (Array.isArray(cam) ? cam[1] : "unknown"), 
        name: cam.name || (Array.isArray(cam) ? cam[2] : "Unnamed Camera")
      })).filter((c: any) => c.id !== "unknown");

      setDiscoveredCameras(realCameras);
      setSelectedCameras(realCameras.map((c: any) => c.id)); // Auto-select all by default
      setStep(3); // Move to the next step

    } catch (err) {
      console.error("Discovery Failed:", err);
      alert("Failed to connect to Eagle Eye. Check your token and try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCamera = (id: string) => {
    if (selectedCameras.includes(id)) {
      setSelectedCameras(selectedCameras.filter(camId => camId !== id));
    } else {
      setSelectedCameras([...selectedCameras, id]);
    }
  };

  const addSopStep = () => {
    if (!newSopStep) return;
    setSopSteps([...sopSteps, newSopStep]);
    setNewSopStep("");
  };

  const handleSaveSiteToSupabase = async () => {
    setIsSaving(true);
    
    const newSitePayload = {
      site: { name: siteName, een_token: eenToken },
      cameras: discoveredCameras.filter(c => selectedCameras.includes(c.id)),
      sops: sopSteps
    };

    console.log("🚀 SENDING TO SUPABASE:", newSitePayload);
    
    setTimeout(() => {
      setIsSaving(false);
      alert("✅ Site Successfully Provisioned to Supabase!");
      // Reset wizard and go back to sites view
      setStep(1);
      setSiteName("");
      setEenToken("");
      setActiveConfigMenu("sites");
    }, 1500);
  };

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
             { id: "new-site", icon: "✨", label: "Provision Site", desc: "Add new property" },
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

          {/* ============================================================================ */}
          {/* VIEW 1: EXISTING DASHBOARD (UNTOUCHED UI) */}
          {/* ============================================================================ */}
          {activeConfigMenu === "sites" && (
            <div className="relative z-10 flex flex-col h-full animate-in fade-in duration-300">
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
                      
                      {/* AUTH BUTTON */}
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

          {/* ============================================================================ */}
          {/* VIEW 2: PROVISION NEW SITE (WIZARD) */}
          {/* ============================================================================ */}
          {activeConfigMenu === "new-site" && (
            <div className="relative z-10 flex flex-col h-full animate-in fade-in duration-300">
              
              <div className="mb-6">
                <h2 className="text-lg font-black text-white tracking-widest uppercase">Provision New Site</h2>
              </div>

              {/* PROGRESS BAR */}
              <div className="flex gap-4 mb-8">
                {[1, 2, 3, 4].map((s) => (
                  <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${step >= s ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-white/10'}`}></div>
                ))}
              </div>

              <div className="flex-1 bg-black/50 border border-white/10 rounded-2xl p-6 overflow-y-auto custom-scrollbar">
                
                {/* STEP 1: Basic Info */}
                {step === 1 && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                    <h3 className="text-sm font-bold text-emerald-400 mb-6 uppercase tracking-widest">1. Property Profile</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Site Name</label>
                        <input 
                          type="text" 
                          value={siteName}
                          onChange={(e) => setSiteName(e.target.value)}
                          placeholder="e.g., Marbella Place" 
                          className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                      </div>
                      <button 
                        disabled={!siteName}
                        onClick={() => setStep(2)} 
                        className="mt-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 px-8 rounded-xl text-xs tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        NEXT: INTEGRATIONS ➔
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2: Integrations (EEN) */}
                {step === 2 && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                    <h3 className="text-sm font-bold text-emerald-400 mb-6 uppercase tracking-widest">2. Video Management (VMS)</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Eagle Eye API Token</label>
                        <input 
                          type="password" 
                          value={eenToken}
                          onChange={(e) => setEenToken(e.target.value)}
                          placeholder="eyJraWQiOiI2ODYxYjBjYS0wZjI..." 
                          className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-slate-600 font-mono text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="flex gap-4 mt-6">
                        <button onClick={() => setStep(1)} className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-3 px-6 rounded-xl text-xs tracking-widest transition-all">BACK</button>
                        <button 
                          disabled={!eenToken || isSaving}
                          onClick={handleDiscoverCameras} 
                          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 px-8 rounded-xl text-xs tracking-widest transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSaving ? "DISCOVERING..." : "DISCOVER CAMERAS 🔍"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3: Camera Mapping */}
                {step === 3 && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                    <h3 className="text-sm font-bold text-emerald-400 mb-2 uppercase tracking-widest">3. Camera Mapping</h3>
                    <p className="text-xs text-slate-400 mb-6">Select which cameras should be active on the SOC dashboard.</p>
                    
                    <div className="grid grid-cols-2 gap-3 mb-6 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                      {discoveredCameras.map((cam) => (
                        <div 
                          key={cam.id} 
                          onClick={() => toggleCamera(cam.id)}
                          className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${selectedCameras.includes(cam.id) ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-white/5 border-white/10 hover:border-white/30'}`}
                        >
                          <div>
                            <h4 className="font-bold text-sm text-white">{cam.name}</h4>
                            <p className="text-[10px] text-slate-500 font-mono">{cam.id}</p>
                          </div>
                          {selectedCameras.includes(cam.id) && <span className="text-emerald-500 text-xl">✓</span>}
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-4">
                      <button onClick={() => setStep(2)} className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-3 px-6 rounded-xl text-xs tracking-widest transition-all">BACK</button>
                      <button onClick={() => setStep(4)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 px-8 rounded-xl text-xs tracking-widest transition-all">NEXT: PROCEDURES ➔</button>
                    </div>
                  </div>
                )}

                {/* STEP 4: Standard Operating Procedures (SOP) */}
                {step === 4 && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                    <h3 className="text-sm font-bold text-emerald-400 mb-2 uppercase tracking-widest">4. Standard Operating Procedures</h3>
                    <p className="text-xs text-slate-400 mb-6">Define the resolution checklist for dispatchers at this site.</p>
                    
                    <div className="space-y-2 mb-6">
                      {sopSteps.map((s, i) => (
                        <div key={i} className="flex items-center gap-3 bg-white/5 border border-white/10 p-3 rounded-lg">
                          <span className="text-emerald-400 font-black">{i + 1}.</span>
                          <span className="text-sm text-slate-300">{s}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 mb-8">
                      <input 
                        type="text" 
                        value={newSopStep}
                        onChange={(e) => setNewSopStep(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addSopStep()}
                        placeholder="e.g., Dispatch local authorities" 
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-emerald-500"
                      />
                      <button onClick={addSopStep} className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 rounded-xl transition-all">+</button>
                    </div>

                    <div className="flex gap-4 pt-6 border-t border-white/10">
                      <button onClick={() => setStep(3)} className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-4 px-6 rounded-xl text-xs tracking-widest transition-all">BACK</button>
                      <button 
                        onClick={handleSaveSiteToSupabase} 
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black py-4 px-8 rounded-xl text-xs tracking-widest transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)]"
                      >
                        {isSaving ? "PROVISIONING..." : "PROVISION SITE TO DB 🚀"}
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* VIEW: HARDWARE / LOGIC (Placeholders) */}
          {(activeConfigMenu === "hardware" || activeConfigMenu === "logic") && (
             <div className="relative z-10 flex h-full items-center justify-center text-slate-500 text-[10px] font-black tracking-[0.3em]">
               MODULE INITIALIZING...
             </div>
          )}

        </div>
      </div>
    </div>
  );
}
