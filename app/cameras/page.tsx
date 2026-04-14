"use client";

import React, { useState, useEffect, useRef } from "react";

// ============================================================================
// 🏢 MOCK PORTFOLIO DATA (Will come from Supabase)
// ============================================================================
const PORTFOLIO_SITES = [
  {
    id: "site-1",
    name: "Pegasus Properties - Marbella Place",
    cameraCount: 11,
    status: "online",
    // High-end property placeholder images
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=1000&auto=format&fit=crop"
  },
  {
    id: "site-2",
    name: "Elevate Eagles Landing",
    cameraCount: 8,
    status: "online",
    image: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?q=80&w=1000&auto=format&fit=crop"
  },
  {
    id: "site-3",
    name: "Elevate Greene",
    cameraCount: 14,
    status: "offline", // Example of a site with network issues
    image: "https://images.unsplash.com/photo-1574362848149-11496d93a7c7?q=80&w=1000&auto=format&fit=crop"
  }
];

const MARBELLA_CAMERAS = [
  { id: "100ba88a", name: "Dumpster" },
  { id: "10059648", name: "Gate" },
  { id: "100ebfc5", name: "Gate Entrance" },
  { id: "1009a37e", name: "gym" },
  { id: "1007d097", name: "Leasing Desk" },
  { id: "100c2e51", name: "Leasing Lobby" },
  { id: "1006bf65", name: "Mail Left" },
  { id: "100601bd", name: "Mail Right" },
  { id: "100fa50d", name: "Maintenance Camera" },
  { id: "100b1c89", name: "Manager Office" },
  { id: "100fd212", name: "Pool Camera" }
];

// ============================================================================
// STABLE HLS PLAYER
// ============================================================================
const SmartVideoPlayer = ({ camId, token, type = 'main' }: any) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<any>(null);

    useEffect(() => {
        if (!camId || !token || !videoRef.current) return;
        const cluster = "media.c031.eagleeyenetworks.com";
        const hlsUrl = `https://${cluster}/media/streams/${type}/hls/getPlaylist.m3u8?esn=${camId}&A=${token}`;

        const video = videoRef.current;
        const startHls = () => {
            if (hlsRef.current) hlsRef.current.destroy();
            if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = hlsUrl;
            } else if ((window as any).Hls && (window as any).Hls.isSupported()) {
                const hls = new (window as any).Hls({ enableWorker: true, lowLatencyMode: true });
                hls.loadSource(hlsUrl);
                hls.attachMedia(video);
                hlsRef.current = hls;
            }
        };

        if (!(window as any).Hls) {
            const script = document.createElement("script");
            script.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
            script.onload = startHls;
            document.head.appendChild(script);
        } else {
            startHls();
        }

        return () => { if (hlsRef.current) hlsRef.current.destroy(); };
    }, [camId, token, type]);

    return <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover bg-black" />;
};

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================
export default function CamerasPage() {
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [selectedSite, setSelectedSite] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // We default to the Marbella token for the live preview if available
    const token = localStorage.getItem(`een_token_Pegasus Properties - Marbella Place`);
    if (token) setActiveToken(token);
  }, []);

  const filteredSites = PORTFOLIO_SITES.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

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
              {selectedSite ? `${MARBELLA_CAMERAS.length} Active Nodes` : "Global Infrastructure Hub"}
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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredSites.map((site) => (
                <div 
                  key={site.id}
                  onClick={() => setSelectedSite(site)}
                  className="group relative h-[300px] bg-[#0a0c10] border border-white/10 rounded-[2.5rem] overflow-hidden cursor-pointer shadow-xl hover:shadow-[0_0_40px_rgba(99,102,241,0.2)] hover:border-indigo-500/50 transition-all duration-500"
                >
                  {/* Property Image Background */}
                  <img 
                    src={site.image} 
                    alt={site.name} 
                    className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity duration-700 group-hover:scale-105"
                  />
                  
                  {/* Gradient Overlay for text readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#030406] via-[#030406]/60 to-transparent"></div>

                  {/* Card Content */}
                  <div className="absolute bottom-0 left-0 w-full p-8 flex justify-between items-end">
                    <div>
                      <h2 className="text-xl font-black tracking-tight text-white mb-2 leading-tight">{site.name}</h2>
                      <div className="flex items-center gap-3">
                        <span className="bg-white/10 backdrop-blur-md border border-white/10 px-3 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase">
                           {site.cameraCount} Cameras
                        </span>
                        <div className="flex items-center gap-2">
                           <span className={`w-2 h-2 rounded-full ${site.status === 'online' ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]' : 'bg-red-500'}`}></span>
                           <span className="text-[9px] font-mono uppercase text-slate-300">{site.status}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Enter Button (Fades in on hover) */}
                    <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 shadow-lg">
                       <span className="text-white font-bold">→</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 2: SPECIFIC SITE VIDEO WALL */}
        {selectedSite && (
          <div className="absolute inset-0 bg-[#0a0c10] border border-white/5 rounded-[3rem] p-4 shadow-inner overflow-hidden flex flex-col">
            <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto custom-scrollbar">
              {MARBELLA_CAMERAS.map(cam => (
                <div key={cam.id} className="aspect-video bg-black border border-white/10 rounded-2xl overflow-hidden relative group hover:border-indigo-500 transition-all shadow-lg">
                  
                  {/* Render Video ONLY if we have a token (to prevent visual errors) */}
                  {activeToken ? (
                      <SmartVideoPlayer camId={cam.id} token={activeToken} type="preview" />
                  ) : (
                      <div className="w-full h-full flex items-center justify-center">
                          <span className="text-[10px] text-slate-700 font-black uppercase tracking-[0.5em]">No API Token</span>
                      </div>
                  )}

                  {/* Camera Label */}
                  <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span className="text-[9px] font-bold text-white tracking-wider uppercase">{cam.name}</span>
                  </div>

                  {/* Quick Actions (Hover) */}
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                     <button className="bg-black/80 backdrop-blur-md border border-white/10 p-2 rounded-lg hover:text-indigo-400 transition-colors">
                        <span className="text-xs">🔍</span>
                     </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
