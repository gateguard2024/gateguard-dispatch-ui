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

        // 1. Get the stream keys
        const res = await fetch('/api/cameras/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteId, cameraId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to fetch stream keys");

        const video = videoRef.current;
        if (!video) return;

        // 🚨 2. Lock the token into a cookie BEFORE starting the stream!
        await fetch('/api/cameras/set-cookie', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: data.token })
        });

        // 3. Build the ultra-clean proxy URL
        const proxyUrl = `/api/cameras/proxy?url=${encodeURIComponent(data.hlsUrl)}`;

        // 4. Mount HLS Player
        if (Hls.isSupported()) {
          hls = new Hls({
             xhrSetup: (xhr) => {
                // Tells the browser to send the cookie with every request
                xhr.withCredentials = true; 
             }
          }); 

          hls.loadSource(proxyUrl);
          hls.attachMedia(video);
          
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setIsLoading(false);
            video.play().catch(() => console.log("Autoplay blocked."));
          });

          hls.on(Hls.Events.ERROR, (event, errorData) => {
            if (errorData.fatal) setError("Stream connection lost.");
          });
        } 
        else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = proxyUrl; 
          video.addEventListener('loadedmetadata', () => {
            setIsLoading(false);
            video.play().catch(() => console.log("Autoplay blocked."));
          });
        }
      } catch (err: any) {
        setError(err.message || "Failed to initialize stream");
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
      className="relative w-full h-full bg-black flex items-center justify-center cursor-pointer group overflow-hidden"
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
          <div className="text-[10px] text-emerald-400 font-black tracking-[0.3em] animate-pulse">
            CONNECTING VAULT...
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-20 px-4 text-center">
          <div className="text-[10px] text-red-500 font-bold tracking-widest bg-red-500/10 border border-red-500/30 px-4 py-2 rounded-lg">
            ❌ {error.toUpperCase()}
          </div>
        </div>
      )}

      <div className="absolute top-2 left-2 bg-black/60 text-white/70 text-[9px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
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
