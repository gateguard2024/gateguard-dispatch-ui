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

      const res = await fetch('/api/cameras/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, cameraId })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const video = videoRef.current;
      if (!video) return;

      // 🚨 CRITICAL FIX: Lock the massive token into a cookie!
      // This stops us from having to put it in the URL, which causes the 400 Bad Request
      await fetch('/api/cameras/set-cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: data.token })
      });

      // Build the clean proxy URL (Notice there is NO token in this string!)
      const proxyUrl = `/api/cameras/proxy?url=${encodeURIComponent(data.hlsUrl)}`;

      if (Hls.isSupported()) {
        hls = new Hls({
           xhrSetup: (xhr) => {
              // Tell hls.js to silently send the cookie to our proxy
              xhr.withCredentials = true; 
           }
        }); 

        hls.loadSource(proxyUrl);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          setRetryCount(0);
          video.play().catch(() => console.log("Autoplay blocked."));
        });

        hls.on(Hls.Events.ERROR, (event, errorData) => {
          if (errorData.fatal) {
            if (errorData.response?.code === 409 || errorData.response?.code === 500) {
                if (retryCount < 3) {
                    hls?.destroy();
                    setRetryCount(prev => prev + 1);
                    setTimeout(startStream, 2000); 
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
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10">
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
