"use client";
// components/SmartVideoPlayer.tsx
//
// Unified HLS video player for GateGuard.
// Supports live EEN streams and recorded clips.
//
// Props:
//   accountId   — Supabase accounts.id (UUID). Replaces old siteId.
//   cameraId    — EEN device ESN or Brivo camera ID.
//   source      — 'een' | 'brivo' (default: 'een')
//   streamType  — 'preview' | 'main' (default: 'main') — reserved for future quality switching
//   recordedUrl — if provided, plays this URL instead of fetching a live stream
//   label       — camera name shown on hover overlay
//
// Auth flow (live streams):
//   1. POST /api/cameras/stream { accountId, cameraId } → { token, hlsUrl }
//   2. POST /api/cameras/set-cookie { token } — locks Bearer token into HTTP cookie
//   3. HLS.js loads via /api/cameras/proxy?url=... with withCredentials:true
//      so the server-side proxy can forward the cookie as an Authorization header

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';

export interface SmartVideoPlayerProps {
  accountId:   string;
  cameraId:    string;
  source?:     'een' | 'brivo';
  streamType?: 'preview' | 'main';
  recordedUrl?: string;
  label?:      string;
}

export default function SmartVideoPlayer({
  accountId,
  cameraId,
  source      = 'een',
  streamType  = 'main',
  recordedUrl,
  label,
}: SmartVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef     = useRef<HTMLVideoElement>(null);
  const [error, setError]           = useState<string | null>(null);
  const [isLoading, setIsLoading]   = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  const startStream = useCallback(async () => {
    let hls: Hls | null = null;

    try {
      setIsLoading(true);
      setError(null);

      const video = videoRef.current;
      if (!video) return;

      let proxyUrl: string;

      if (recordedUrl) {
        // ── Recorded clip: play URL directly ──────────────────────────────
        proxyUrl = recordedUrl;
      } else {
        // ── Live stream: fetch HLS URL + auth token from server ───────────
        const res = await fetch('/api/cameras/stream', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ accountId, cameraId, source }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Stream unavailable');

        // Lock Bearer token into HTTP cookie so HLS segment requests
        // can be proxied server-side with proper Authorization header
        await fetch('/api/cameras/set-cookie', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ token: data.token }),
        });

        proxyUrl = `/api/cameras/proxy?url=${encodeURIComponent(data.hlsUrl)}`;
      }

      // ── Mount HLS player ───────────────────────────────────────────────
      if (Hls.isSupported()) {
        hls = new Hls({
          xhrSetup: (xhr) => {
            xhr.withCredentials = true; // sends cookie to proxy route
          },
        });
        hls.loadSource(proxyUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          setRetryCount(0);
          video.play().catch(() => {});
        });

        hls.on(Hls.Events.ERROR, (_, errData) => {
          if (errData.fatal) {
            // EEN sometimes returns 409 (ghost session lock) or 500 on first connect
            const code = errData.response?.code;
            if ((code === 409 || code === 500) && retryCount < 3) {
              hls?.destroy();
              setRetryCount(prev => prev + 1);
              setTimeout(startStream, 2500);
            } else {
              setError('Stream connection lost.');
              setIsLoading(false);
            }
          }
        });

      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        video.src = proxyUrl;
        video.addEventListener('loadedmetadata', () => {
          setIsLoading(false);
          setRetryCount(0);
          video.play().catch(() => {});
        });
      }

    } catch (err: any) {
      setError(err.message ?? 'Failed to initialize stream');
      setIsLoading(false);
    }

    return () => { if (hls) hls.destroy(); };
  }, [accountId, cameraId, source, recordedUrl, retryCount]);

  useEffect(() => {
    const cleanup = startStream();
    return () => { cleanup.then(fn => fn && fn()); };
  }, [startStream]);

  // Fullscreen removed — handled by the parent view (View 3 single-cam).
  // Browser native fullscreen still available via right-click on the video element.

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black flex items-center justify-center group overflow-hidden"
    >
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10 backdrop-blur-sm">
          <div className="text-[10px] text-emerald-400 font-black tracking-[0.3em] animate-pulse">
            CONNECTING...
          </div>
          {retryCount > 0 && (
            <div className="text-[8px] text-slate-400 mt-2 tracking-widest uppercase">
              CLEARING STALE LOCK ({retryCount}/3)
            </div>
          )}
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-20 px-4 text-center">
          <div className="text-[10px] text-red-500 font-bold tracking-widest bg-red-500/10 border border-red-500/30 px-4 py-2 rounded-lg">
            ❌ {error.toUpperCase()}
          </div>
        </div>
      )}

      {/* Hover hint */}
      <div className="absolute top-3 left-3 bg-black/60 text-white/70 text-[9px] font-bold px-2.5 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none border border-white/10">
        {label ? `${label} · ` : ''}DOUBLE-CLICK FOR FULLSCREEN
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
