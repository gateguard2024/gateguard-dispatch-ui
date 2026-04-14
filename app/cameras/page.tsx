"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import SmartVideoPlayer from "@/components/SmartVideoPlayer"; // Bring in our secure video component

export default function CamerasPage() {
  const [sites, setSites] = useState<any[]>([]);
  const [siteCameras, setSiteCameras] = useState<any[]>([]);
  const [selectedSite, setSelectedSite] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // 1. Fetch Real Sites on Load
  useEffect(() => {
    const fetchSites = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('sites')
        .select('*')
        .order('name', { ascending: true });

      if (!error && data) setSites(data);
      setIsLoading(false);
    };
    fetchSites();
  }, []);

  // 2. Fetch Real Cameras when a Site is Clicked
  useEffect(() => {
    const fetchCameras = async () => {
      if (!selectedSite) {
        setSiteCameras([]);
        return;
      }
      
      const { data, error } = await supabase
        .from('cameras')
        .select('*')
        .eq('site_id', selectedSite.id)
        .order('name', { ascending: true });

      if (!error && data) setSiteCameras(data);
    };

    fetchCameras();
  }, [selectedSite]);

  const filteredSites = sites.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full h-full flex flex-col p-4 lg:p-6 bg-[#030406] text-white font-sans overflow-hidden">
      
      {/* 🚀 HEADER: Adapts based on view */}
      <div className="flex justify-between items-center mb-6 bg-[#0a0c10] border border-white/5 rounded-[2rem] p-6 backdrop-blur-md shadow-2xl shrink-0">
        <div className="flex items-center gap-6">
          
          {selectedSite && (
            <button 
              onClick={() => setSelectedSite(null)}
              className="w-10 h-10 bg-white/5 hover:bg-indigo-600 border border-white/10 hover:border-indigo-500 rounded-xl flex items-center justify-center transition-all group"
            >
              <span className="text-lg group-hover:-translate-x-1 transition-transform">←</span>
            </button>
          )}

          <div>
            <h1 className="text-2xl font-black tracking-tighter">
              {selectedSite ? selectedSite.name : "PORTFOLIO SURVEILLANCE"}
            </h1>
            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-[0.2em] mt-1">
              {selectedSite ? `${siteCameras.length} Active Nodes` : "Global Infrastructure Hub"}
            </p>
          </div>
        </div>

        {/* Search Bar (Only in Portfolio View) */}
        {!selectedSite && (
          <div className="relative w-72">
            <input 
              type="text" 
              placeholder="Search properties..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
            />
            <span className="absolute right-4 top-3.5 opacity-40">🔍</span>
          </div>
        )}
        
        {/* Wall Controls (Only in Site View) */}
        {selectedSite && (
          <div className="flex gap-3">
             <button className="bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all">
                Save Layout
             </button>
             <button className="bg-white/5 text-slate-300 border border-white/10 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">
                Full Screen
             </button>
          </div>
        )}
      </div>

      {/* 🖼️ MAIN CONTENT AREA */}
      <div className="flex-1 overflow-hidden relative">
        
        {/* VIEW 1: PORTFOLIO GRID */}
        {!selectedSite && (
          <div className="absolute inset-0 overflow-y-auto custom-scrollbar pr-2 pb-10">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-slate-500 tracking-widest">
                LOADING PORTFOLIO...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredSites.map((site) => (
                  <div 
                    key={site.id}
                    onClick={() => setSelectedSite(site)}
                    className="group relative h-[300px] bg-[#0a0c10] border border-white/10 rounded-[2.5rem] overflow-hidden cursor-pointer shadow-xl hover:shadow-[0_0_40px_rgba(99,102,241,0.2)] hover:border-indigo-500/50 transition-all duration-500"
                  >
                    {/* Placeholder image (since DB might not have images yet) */}
                    <img 
                      src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=1000&auto=format&fit=crop" 
                      alt={site.name} 
                      className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity duration-700 group-hover:scale-105"
                    />
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-[#030406] via-[#030406]/60 to-transparent"></div>

                    <div className="absolute bottom-0 left-0 w-full p-8 flex justify-between items-end">
                      <div>
                        <h2 className="text-xl font-black tracking-tight text-white mb-2 leading-tight">{site.name}</h2>
                        <div className="flex items-center gap-3">
                          <span className="bg-white/10 backdrop-blur-md border border-white/10 px-3 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase">
                             Access Hub
                          </span>
                          <div className="flex items-center gap-2">
                             <span className={`w-2 h-2 rounded-full ${site.een_refresh_token ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]' : 'bg-red-500'}`}></span>
                             <span className="text-[9px] font-mono uppercase text-slate-300">
                               {site.een_refresh_token ? 'Online' : 'Offline'}
                             </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 shadow-lg">
                         <span className="text-white font-bold">→</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: SPECIFIC SITE VIDEO WALL */}
        {selectedSite && (
          <div className="absolute inset-0 bg-[#0a0c10] border border-white/5 rounded-[3rem] p-4 shadow-inner overflow-hidden flex flex-col">
            <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto custom-scrollbar">
              
              {siteCameras.length === 0 ? (
                 <div className="col-span-full h-full flex flex-col items-center justify-center text-slate-500 tracking-widest gap-4">
                    <span>NO CAMERAS SYNCED FOR THIS SITE</span>
                 </div>
              ) : (
                siteCameras.map(cam => (
                  <div key={cam.id} className="aspect-video bg-black border border-white/10 rounded-2xl overflow-hidden relative group hover:border-indigo-500 transition-all shadow-lg">
                    
                    {/* 🚀 THE SECURE LIVE FEED PLAYER */}
                    <SmartVideoPlayer siteId={selectedSite.id} cameraId={cam.een_camera_id} />

                    {/* Camera Label */}
                    <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${cam.status.includes('ATTD') ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                      <span className="text-[9px] font-bold text-white tracking-wider uppercase">{cam.name}</span>
                    </div>

                    {/* Quick Actions */}
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                       <button className="bg-black/80 backdrop-blur-md border border-white/10 p-2 rounded-lg hover:text-indigo-400 transition-colors">
                          <span className="text-xs">🔍</span>
                       </button>
                    </div>
                  </div>
                ))
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
