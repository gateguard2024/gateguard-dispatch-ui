"use client";

import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

export default function SmartVideoPlayer({ siteId, cameraId }: { siteId: string, cameraId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let hls: Hls;

    const startStream = async () => {
      try {
        // 1. Get the raw stream URL and the Token from our backend
        const res = await fetch('/api/cameras/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteId, cameraId })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        const video = videoRef.current;
        if (!video) return;

        // 🚨 ROUTE THROUGH PROXY:
        // We append the access token to the EEN URL, then wrap it in our Proxy
        const streamUrl = new URL(data.hlsUrl);
        streamUrl.searchParams.append('access_token', data.token);
        
        const proxyUrl = `/api/cameras/proxy?url=${encodeURIComponent(streamUrl.toString())}&token=${data.token}`;

        // 2. Mount HLS Player pointing to VERCEL, not Eagle Eye!
        if (Hls.isSupported()) {
          hls = new Hls(); 

          hls.loadSource(proxyUrl);
          hls.attachMedia(video);
          
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setIsLoading(false);
            video.play().catch(() => console.log("Autoplay blocked."));
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) setError("Stream connection lost.");
          });
        } 
        // Safari fallback
        else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = proxyUrl;
          video.addEventListener('loadedmetadata', () => {
            setIsLoading(false);
            video.play();
          });
        }
      } catch (err: any) {
        setError(err.message);
        setIsLoading(false);
      }
    };

    startStream();

    return () => {
      if (hls) hls.destroy();
    };
  }, [siteId, cameraId]);

  const handleDoubleClick = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (err: any) {
      console.error("Fullscreen error:", err.message);
    }
  };

  return (
    <div 
      ref={containerRef}
      onDoubleClick={handleDoubleClick}
      className="relative w-full h-full bg-black flex items-center justify-center cursor-pointer group"
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-emerald-500 font-bold tracking-widest animate-pulse z-10 bg-black/50">
          CONNECTING VAULT...
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-red-500 font-bold tracking-widest bg-black/90 z-10 text-center px-4">
          ❌ {error.toUpperCase()}
        </div>
      )}

      <div className="absolute top-2 left-2 bg-black/60 text-white/70 text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
        Double-click for Fullscreen
      </div>

      <video 
        ref={videoRef} 
        autoPlay 
        muted 
        playsInline
        className="w-full h-full object-cover"
      />
    </div>
  );
}
