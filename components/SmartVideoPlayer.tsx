// components/SmartVideoPlayer.tsx
"use client";

import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

export default function SmartVideoPlayer({ siteId, cameraId }: { siteId: string, cameraId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let hls: Hls;

    const startStream = async () => {
      try {
        // 1. Ask our backend for the URL and Auth Token
        const res = await fetch('/api/cameras/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteId, cameraId })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        const video = videoRef.current;
        if (!video) return;

        // 2. Mount HLS Player and inject the EEN Auth Token
        if (Hls.isSupported()) {
          hls = new Hls({
            xhrSetup: (xhr) => {
              xhr.setRequestHeader('Authorization', `Bearer ${data.token}`);
            }
          });

          hls.loadSource(data.hlsUrl);
          hls.attachMedia(video);
          
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setIsLoading(false);
            video.play().catch(() => console.log("Autoplay blocked. User must click play."));
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) setError("Stream connection lost.");
          });
        } 
        // Safari fallback
        else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = data.hlsUrl;
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

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center">
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
