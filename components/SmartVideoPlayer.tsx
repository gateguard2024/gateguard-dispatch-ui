'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface SmartVideoPlayerProps {
  siteId: string;
  cameraEsn: string;
  streamType?: 'main' | 'preview'; // main = high res, preview = low res/fast load
}

export default function SmartVideoPlayer({ siteId, cameraEsn, streamType = 'main' }: SmartVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let hls: Hls;

    const initializeStream = async () => {
      try {
        setIsLoading(true);
        // 1. Get the dynamic, valid token and cluster for this specific site
        const response = await fetch(`/api/video/token?siteId=${siteId}`);
        if (!response.ok) throw new Error('Failed to load secure video token');
        
        const { token, cluster } = await response.json();

        // 2. Construct the Eagle Eye HLS Stream URL
        // Notice we append ?A=token so the EEN servers authorize the direct media request
        const streamUrl = `https://${cluster}/api/v3.0/cameras/${cameraEsn}/media/streams/${streamType}/hls/getPlaylist.m3u8?A=${token}`;

        // 3. Attach it to the Video element
        if (videoRef.current) {
          if (Hls.isSupported()) {
            hls = new Hls({
              // EEN specific tweaks for lower latency
              lowLatencyMode: true,
              liveSyncDurationCount: 3, 
            });
            hls.loadSource(streamUrl);
            hls.attachMedia(videoRef.current);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              setIsLoading(false);
              videoRef.current?.play().catch(e => console.log("Auto-play prevented", e));
            });
            hls.on(Hls.Events.ERROR, (event, data) => {
              if (data.fatal) setError('Stream connection failed');
            });
          } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
            // Fallback for Safari which has native HLS support
            videoRef.current.src = streamUrl;
            videoRef.current.addEventListener('loadedmetadata', () => {
              setIsLoading(false);
              videoRef.current?.play();
            });
          }
        }
      } catch (err: any) {
        setError(err.message);
        setIsLoading(false);
      }
    };

    initializeStream();

    // Cleanup when the component unmounts
    return () => {
      if (hls) hls.destroy();
    };
  }, [siteId, cameraEsn, streamType]);

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden border border-[#2A2A2A]">
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-[#00E5FF] font-mono text-xs">
          ESTABLISHING SECURE CONNECTION...
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-red-500 font-mono text-xs text-center p-4">
          SIGNAL LOST: {error}
        </div>
      )}

      <video 
        ref={videoRef} 
        className="w-full h-full object-contain"
        autoPlay 
        muted 
        playsInline 
      />
      
      {/* Tactical UI Overlay */}
      <div className="absolute top-3 left-3 bg-black/60 px-2 py-1 rounded text-[10px] font-mono text-white/70 border border-white/10 backdrop-blur-md">
        ESN: {cameraEsn} • {streamType.toUpperCase()}
      </div>
      <div className="absolute top-3 right-3 flex items-center space-x-2">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
        <span className="text-[10px] font-mono text-red-500 font-bold tracking-widest">LIVE</span>
      </div>
    </div>
  );
}
