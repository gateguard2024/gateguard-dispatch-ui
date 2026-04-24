"use client";

// UPDATED FILE: components/SmartVideoPlayer.tsx
// UPDATE: Added `source` prop ('brivo' | 'een') to route stream requests correctly.
//         EEN   → /api/cameras/stream  (ACTIVE — current integration)
//         Brivo → /api/brivo/stream    (DORMANT — code ready, activate when EEN is 100%)
// Default source is 'een'. Change default to 'brivo' when Brivo video is enabled.
// All other behavior (HLS.js, proxy, cookie, retry) unchanged.

import React, { useEffect, useRef, useState, useCallback, MouseEvent } from 'react';
import Hls from 'hls.js';

interface SmartVideoPlayerProps {
  accountId:        string;
  cameraId:         string;
  source?:          'een' | 'brivo';
  streamType?:      'main' | 'preview';
  recordedUrl?:     string;
  recordedToken?:   string;
  label?:           string;
  disableFullscreen?: boolean;  // Set true on wall-view tiles to prevent double-click fullscreen conflict
}

export default function SmartVideoPlayer({
  accountId,
  cameraId,
  source            = 'een',
  streamType        = 'main',
  recordedUrl,
  recordedToken,
  label,
  disableFullscreen = false,
}: SmartVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef     = useRef<HTMLVideoElement>(null);
  const hlsRef       = useRef<Hls | null>(null);

  const [status, setStatus]         = useState<'loading' | 'playing' | 'error'>('loading');
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Playback controls (recorded only)
  const [isPlaying, setIsPlaying]   = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]     = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const progressRef = useRef<HTMLDivElement>(null);

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
        // EEN media servers block cross-origin requests (no CORS headers).
        // We must proxy all HLS traffic through our server which:
        //   1. Adds the Bearer token to every EEN request
        //   2. Rewrites relative segment URLs in the manifest to also use our proxy
        // Route: /api/een/hls?accountId={id}&url={encoded_een_url}
        if (recordedToken) {
          proxyUrl = `/api/een/hls?accountId=${encodeURIComponent(accountId)}&url=${encodeURIComponent(recordedUrl)}`;
        } else {
          // Fallback: old proxy (no token — segments may fail)
          proxyUrl = recordedUrl.includes('?')
            ? `/api/cameras/proxy?url=${encodeURIComponent(recordedUrl)}`
            : recordedUrl;
        }
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
          const hls = new Hls(recordedUrl ? {
            // Recorded: buffer generously for smooth scrubbing
            lowLatencyMode:   false,
            backBufferLength: 60,
            xhrSetup: (xhr) => { xhr.withCredentials = true; },
          } : {
            // Live: minimise latency — start playing as soon as first segment arrives
            lowLatencyMode:            true,
            liveSyncDurationCount:     1,      // stay 1 segment from live edge
            liveMaxLatencyDurationCount: 4,    // seek to live edge if >4 segments behind
            maxLiveSyncPlaybackRate:   1.5,    // speed up to catch live edge when lagging
            maxBufferLength:           8,      // don't over-buffer on live
            maxMaxBufferLength:        16,
            manifestLoadingTimeOut:    8000,
            manifestLoadingMaxRetry:   3,
            backBufferLength:          10,
            xhrSetup: (xhr) => { xhr.withCredentials = true; },
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

  // Wire up playback events for recorded video
  useEffect(() => {
    if (!recordedUrl) return;
    const video = videoRef.current;
    if (!video) return;

    const onTime     = () => setCurrentTime(video.currentTime);
    const onDuration = () => setDuration(video.duration || 0);
    const onPlay     = () => setIsPlaying(true);
    const onPause    = () => setIsPlaying(false);
    const onEnded    = () => setIsPlaying(false);

    video.addEventListener('timeupdate',      onTime);
    video.addEventListener('durationchange',  onDuration);
    video.addEventListener('loadedmetadata',  onDuration);
    video.addEventListener('play',            onPlay);
    video.addEventListener('pause',           onPause);
    video.addEventListener('ended',           onEnded);

    return () => {
      video.removeEventListener('timeupdate',     onTime);
      video.removeEventListener('durationchange', onDuration);
      video.removeEventListener('loadedmetadata', onDuration);
      video.removeEventListener('play',           onPlay);
      video.removeEventListener('pause',          onPause);
      video.removeEventListener('ended',          onEnded);
    };
  }, [recordedUrl, status]);

  // ── Playback control handlers ─────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) { video.play().catch(() => {}); }
    else              { video.pause(); }
  }, []);

  const skip = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds));
  }, []);

  const changeSpeed = useCallback((rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
  }, []);

  const seekTo = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const bar   = progressRef.current;
    const video = videoRef.current;
    if (!bar || !video || !duration) return;
    const rect  = bar.getBoundingClientRect();
    const pct   = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = pct * duration;
  }, [duration]);

  const fmtTime = (s: number): string => {
    if (!isFinite(s) || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const SPEEDS = [1, 2, 4, 8];

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
      onDoubleClick={disableFullscreen ? undefined : toggleFullscreen}
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
        className={`w-full object-contain bg-black ${recordedUrl ? 'h-[calc(100%-52px)]' : 'h-full'}`}
      />

      {/* ── Recorded playback controls ──────────────────────────────────── */}
      {recordedUrl && status === 'playing' && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm border-t border-white/[0.08] px-2 py-1.5 flex flex-col gap-1.5 z-20">

          {/* Timeline scrubber */}
          <div
            ref={progressRef}
            onClick={seekTo}
            className="relative h-2 bg-white/10 rounded-full cursor-pointer group/bar hover:h-3 transition-all"
          >
            {/* Buffered / progress */}
            <div
              className="absolute inset-y-0 left-0 bg-indigo-500 rounded-full pointer-events-none"
              style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
            />
            {/* Scrub handle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow pointer-events-none opacity-0 group-hover/bar:opacity-100 transition-opacity"
              style={{ left: duration ? `calc(${(currentTime / duration) * 100}% - 6px)` : '0' }}
            />
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-2">
            {/* RR 10s */}
            <button
              onClick={() => skip(-10)}
              className="p-1 text-slate-400 hover:text-white transition-colors"
              title="Back 10s"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.5 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7V7l-4-4 4-4v2.05A9.01 9.01 0 0 1 12.5 3z"/>
                <text x="7" y="15" fontSize="6" fill="currentColor" textAnchor="middle">10</text>
              </svg>
            </button>

            {/* Play / Pause */}
            <button
              onClick={togglePlay}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21"/>
                </svg>
              )}
            </button>

            {/* FF 10s */}
            <button
              onClick={() => skip(10)}
              className="p-1 text-slate-400 hover:text-white transition-colors"
              title="Forward 10s"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.5 3a9 9 0 1 1-9 9h2a7 7 0 1 0 7-7V7l4-4-4-4v2.05A9.01 9.01 0 0 0 11.5 3z"/>
                <text x="17" y="15" fontSize="6" fill="currentColor" textAnchor="middle">10</text>
              </svg>
            </button>

            {/* Timecode */}
            <span className="text-[10px] text-slate-400 font-mono ml-1 shrink-0">
              {fmtTime(currentTime)} / {fmtTime(duration)}
            </span>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Speed controls */}
            <div className="flex items-center gap-0.5">
              {SPEEDS.map(s => (
                <button
                  key={s}
                  onClick={() => changeSpeed(s)}
                  className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition-all ${
                    playbackRate === s
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]'
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
