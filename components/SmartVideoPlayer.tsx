"use client";

import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface SmartVideoPlayerProps {
  siteId: string;
  cameraId: string;
}

export default function SmartVideoPlayer({ siteId, cameraId }: SmartVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let hls: Hls;

    const startStream = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // 1. Fetch the raw stream URL and the live Token from our backend
        const res = await fetch('/api/cameras/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteId, cameraId })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to fetch stream keys");

        const video = videoRef.current;
        if (!video) return;

        // 2. Build a clean, short proxy URL (NO MASSIVE TOKENS IN THE STRING)
        const proxyUrl = `/api/cameras/proxy?url=${encodeURIComponent(data.hlsUrl)}`;

        // 3. Mount HLS Player pointing to Vercel
        if (Hls.isSupported()) {
          hls = new Hls({
            // 🚨 THE FIX: Inject the massive EEN token as a secure Header
            xhrSetup: (xhr) => {
              xhr.setRequestHeader('Authorization', `Bearer ${data.token}`);
            }
          }); 

          hls.loadSource(proxyUrl);
          hls.attachMedia(video);
          
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setIsLoading(false);
            video.play().catch(() => console.log("Autoplay blocked by browser policy."));
          });

          hls.on(Hls.Events.ERROR, (event, errorData) => {
            if (errorData.fatal) {
              setError("Stream connection lost. Retrying...");
              hls.recoverMediaError();
            }
          });
        } 
        // 4. Safari Native Fallback
        // Safari handles HLS natively and doesn't use hls.js, so it can't easily set headers.
        // For Safari, we append the token directly to the URL.
        else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = `${proxyUrl}&token=${data.token}`;
          video.addEventListener('loadedmetadata', () => {
            setIsLoading(false);
            video.play().catch(() => console.log("Autoplay blocked."));
          });
        }
      } catch (err: any) {
        console.error("Stream initialization error:", err);
        setError(err.message || "Failed to initialize stream");
        setIsLoading(false);
      }
    };

    startStream();

    // Cleanup memory when the component unmounts
    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [siteId, cameraId]);

  // 🚀 Fullscreen API Handler
  const handleDoubleClick = async () => {
    if (!containerRef.current) return;
    
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (err: any) {
      console.error("Fullscreen toggle failed:", err.message);
    }
  };

  return (
    <div 
      ref={containerRef}
      onDoubleClick={handleDoubleClick}
      className="relative w-full h-full bg-black flex items-center justify-center cursor-pointer group overflow-hidden"
    >
      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10 backdrop-blur-sm">
          <div className="text-[10px] text-emerald-400 font-black tracking-[0.3em] animate-pulse">
            CONNECTING VAULT...
          </div>
        </div>
      )}
      
      {/* Error State */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-20 px-4 text-center">
          <div className="text-[10px] text-red-500 font-bold tracking-widest border border-red-500/30 bg-red-500/10 px-4 py-2 rounded-lg">
            ❌ {error.toUpperCase()}
          </div>
        </div>
      )}

      {/* UX Hint: Double-click to expand */}
      <div className="absolute top-3 left-3 bg-black/60 text-white/70 text-[9px] font-bold tracking-wider px-2.5 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20 pointer-events-none border border-white/10">
        DOUBLE-CLICK FOR FULLSCREEN
      </div>

      {/* The actual video element */}
      <video 
        ref={videoRef} 
        autoPlay 
        muted 
        playsInline
        className="w-full h-full object-contain bg-black"
      />
    </div>
  );
}
