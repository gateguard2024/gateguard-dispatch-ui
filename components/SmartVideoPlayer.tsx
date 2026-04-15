"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  const [retryCount, setRetryCount] = useState(0); 

  const startStream = useCallback(async () => {
    let hls: Hls | null = null;
    
    try {
      setIsLoading(true);
      setError(null);

      // 1. Fetch stream keys
      const res = await fetch('/api/cameras/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, cameraId })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const video = videoRef.current;
      if (!video) return;

      // 2. Lock the token into the HTTP cookie
      await fetch('/api/cameras/set-cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: data.token })
      });

      // 3. Build the clean proxy URL
      const proxyUrl = `/api/cameras/proxy?url=${encodeURIComponent(data.hlsUrl)}`;

      // 4. Mount Player
      if (Hls.isSupported()) {
        hls = new Hls({
           xhrSetup: (xhr) => {
              xhr.withCredentials = true; // 🚨 Ensures the cookie is sent to the Vercel Proxy
           }
        }); 

        hls.loadSource(proxyUrl);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          setRetryCount(0); // Reset retries on success!
          video.play().catch(() => console.log("Autoplay blocked."));
        });

        hls.on(Hls.Events.ERROR, (event, errorData) => {
          if (errorData.fatal) {
            // Catch EEN's undocumented 409 Conflict ghost session lock
            if (errorData.response?.code === 409 || errorData.response?.code === 500) {
                if (retryCount < 3) {
                    hls?.destroy();
                    setRetryCount(prev => prev + 1);
                    setTimeout(startStream, 2500); // Wait 2.5 seconds for EEN to clear the lock
                } else {
                    setError("Stream locked by another session.");
                    setIsLoading(false);
                }
            } else {
                setError("Stream connection lost.");
                setIsLoading(false);
            }
          }
        });
      } 
      else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = proxyUrl; 
        video.addEventListener('loadedmetadata', () => {
          setIsLoading(false);
          setRetryCount(0);
          video.play().catch(() => console.log("Autoplay blocked."));
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to initialize stream");
      setIsLoading(false);
    }

    return () => {
      if (hls) hls.destroy();
    };
  }, [siteId, cameraId, retryCount]);

  useEffect(() => {
    const cleanup = startStream();
    return () => {
        cleanup.then(fn => fn && fn());
    };
  }, [startStream]);

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
      className="relative w-full h-full bg-black flex items-center justify-center cursor-pointer group overflow-hidden"
    >
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10 backdrop-blur-sm">
          <div className="text-[10px] text-emerald-400 font-black tracking-[0.3em] animate-pulse">
            CONNECTING VAULT...
          </div>
          {retryCount > 0 && (
             <div className="text-[8px] text-slate-400 mt-2 tracking-widest uppercase">
                CLEARING STALE LOCK ({retryCount}/3)
             </div>
          )}
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-20 px-4 text-center">
          <div className="text-[10px] text-red-500 font-bold tracking-widest bg-red-500/10 border border-red-500/30 px-4 py-2 rounded-lg">
            ❌ {error.toUpperCase()}
          </div>
        </div>
      )}

      <div className="absolute top-3 left-3 bg-black/60 text-white/70 text-[9px] font-bold px-2.5 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none border border-white/10">
        DOUBLE-CLICK FOR FULLSCREEN
      </div>

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
