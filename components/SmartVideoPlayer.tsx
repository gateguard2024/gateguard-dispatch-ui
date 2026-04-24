"use client";

// UPDATED FILE: components/SmartVideoPlayer.tsx
// UPDATE: Added `source` prop ('brivo' | 'een') to route stream requests correctly.
//         EEN   → /api/cameras/stream  (ACTIVE — current integration)
//         Brivo → /api/brivo/stream    (DORMANT — code ready, activate when EEN is 100%)
// Default source is 'een'. Change default to 'brivo' when Brivo video is enabled.
// All other behavior (HLS.js, proxy, cookie, retry) unchanged.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';

interface SmartVideoPlayerProps {
  accountId:     string;
  cameraId:      string;
  source?:       'een' | 'brivo';     // Which API to use for live stream ('een' is active)
  streamType?:   'main' | 'preview';  // 'main' = high-res, 'preview' = low-res
  recordedUrl?:  string;              // If set, plays this URL instead of fetching live
  recordedToken?: string;             // EEN Bearer token — required for recorded HLS auth
  label?:        string;              // Optional overlay label
}

export default function SmartVideoPlayer({
  accountId,
  cameraId,
  source       = 'een',
  streamType   = 'main',
  recordedUrl,
  recordedToken,
  label,
}: SmartVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef     = useRef<HTMLVideoElement>(null);
  const hlsRef       = useRef<Hls | null>(null);

  const [status, setStatus]         = useState<'loading' | 'playing' | 'error'>('loading');
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const startStream = useCallback(async () => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    setStatus('loading');
    setErrorMsg(null);

    const video = videoRef.current;
    if (!video) return;

    try {
      let proxyUrl: string;

      if (recordedUrl) {
        // ── Recorded playback ─────────────────────────────────────────────
        // EEN HLS recorded URLs require Bearer token injected per-request.
        // Use HLS.js fetchSetup to inject auth header directly (per EEN docs).
        if (recordedToken && Hls.isSupported()) {
          const hls = new Hls({
            fetchSetup: (context, init) => {
              const headers = new Headers((init.headers as HeadersInit) || {});
              headers.set('Authorization', `Bearer ${recordedToken}`);
              return new Request(context.url, { ...init, headers });
            },
            lowLatencyMode:   false,
            backBufferLength: 60,
          });
          hlsRef.current = hls;
          hls.loadSource(recordedUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setStatus('playing');
            setRetryCount(0);
            video.play().catch(() => {});
          });
          hls.on(Hls.Events.ERROR, (_event, errData) => {
            if (!errData.fatal) return;
            setErrorMsg('Recorded stream error — clip may still be processing');
            setStatus('error');
          });
          return; // HLS set up directly — skip mountHls below
        }
        // Fallback: proxy approach (no token available)
        proxyUrl = recordedUrl.includes('?')
          ? `/api/cameras/proxy?url=${encodeURIComponent(recordedUrl)}`
          : recordedUrl;
      } else {
        // ── Live stream: pick endpoint by source ──────────────────────────
        const endpoint = source === 'brivo'
          ? '/api/brivo/stream'
          : '/api/cameras/stream';

        const res  = await fetch(endpoint, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ accountId, cameraId, streamType }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to get stream');

        // Store token in HttpOnly cookie for proxy auth
        if (data.token) {
          await fetch('/api/cameras/set-cookie', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ token: data.token }),
          });
        }

        proxyUrl = `/api/cameras/proxy?url=${encodeURIComponent(data.hlsUrl)}`;
      }

      // ── Mount HLS player ───────────────────────────────────────────────
      const mountHls = (url: string) => {
        if (Hls.isSupported()) {
          const hls = new Hls({
            xhrSetup: (xhr) => {
              xhr.withCredentials = true;
            },
            lowLatencyMode:   !recordedUrl,
            backBufferLength: recordedUrl ? 60 : 10,
          });

          hlsRef.current = hls;
          hls.loadSource(url);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setStatus('playing');
            setRetryCount(0);
            video.play().catch(() => {});
          });

          hls.on(Hls.Events.ERROR, (_event, errData) => {
            if (!errData.fatal) return;
            const code = errData.response?.code;
            if ((code === 409 || code === 500) && retryCount < 3) {
              hls.destroy();
              const delay = (retryCount + 1) * 2500;
              console.warn(`Stream lock. Retry ${retryCount + 1}/3 in ${delay}ms...`);
              setTimeout(() => setRetryCount((n) => n + 1), delay);
            } else {
              setErrorMsg(code === 409 ? 'Stream locked by another session' : 'Stream connection lost');
              setStatus('error');
            }
          });

        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = url;
          video.addEventListener('loadedmetadata', () => {
            setStatus('playing');
            setRetryCount(0);
            video.play().catch(() => {});
          }, { once: true });
        } else {
          throw new Error('HLS is not supported in this browser');
        }
      };

      mountHls(proxyUrl);

    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initialize stream');
      setStatus('error');
    }
  }, [accountId, cameraId, source, streamType, recordedUrl, recordedToken, retryCount]);

  useEffect(() => {
    startStream();
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [startStream]);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (_) {}
  };

  return (
    <div
      ref={containerRef}
      onDoubleClick={toggleFullscreen}
      className="relative w-full h-full bg-black flex items-center justify-center cursor-pointer overflow-hidden group"
    >
      {/* Loading overlay */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 gap-2">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          {retryCount > 0 && (
            <p className="text-[9px] text-slate-400 uppercase tracking-widest">
              Clearing lock — attempt {retryCount}/3
            </p>
          )}
        </div>
      )}

      {/* Error overlay */}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20 gap-2 px-4 text-center">
          <p className="text-[10px] text-red-400 font-semibold uppercase tracking-wider">
            {errorMsg}
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); setRetryCount(0); }}
            className="text-[10px] text-slate-400 hover:text-white underline mt-1 transition-all"
          >
            Retry
          </button>
        </div>
      )}

      {/* Camera label */}
      {label && status === 'playing' && (
        <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm border border-white/10 px-2.5 py-1 rounded text-[9px] font-semibold text-white uppercase tracking-wider z-10 pointer-events-none">
          {label}
        </div>
      )}

      {/* Recorded badge */}
      {recordedUrl && status === 'playing' && (
        <div className="absolute top-2 left-2 bg-amber-600/80 border border-amber-500/40 px-2 py-0.5 rounded text-[9px] font-bold text-white uppercase tracking-wider z-10 pointer-events-none">
          Recorded
        </div>
      )}

      {/* Fullscreen hint */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
        <div className="bg-black/60 border border-white/10 px-2 py-0.5 rounded text-[9px] text-white/60">
          Double-click for fullscreen
        </div>
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
