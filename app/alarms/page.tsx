"use client";

import React, { useState, useEffect, useRef } from "react";
import Hls from "hls.js";

// --- MOCK DATA FOR UI STRUCTURE ---
// In the future, this will be populated by your EEN API proxy calls
const MOCK_SITES = [
  { id: "SITE-8259", name: "Pegasus Properties - Marbella Place", cameras: [{ id: "10054b8c", name: "Amenity Hall" }, { id: "cam2", name: "Front Gate" }, { id: "cam3", name: "Pool Area" }] },
  { id: "SITE-8260", name: "Elevate Eagles Landing", cameras: [{ id: "cam4", name: "Leasing Office" }, { id: "cam5", name: "Dumpster" }] },
];

const MOCK_ALARMS = [
  { id: 1, siteName: "Pegasus Properties - Marbella Place", cameraId: "10054b8c", camName: "Amenity Hall", type: "Motion Detected", time: "00:12s", severity: "high" },
  { id: 2, siteName: "Elevate Eagles Landing", cameraId: "cam4", camName: "Leasing Office", type: "Person Loitering", time: "04:30s", severity: "medium" }
];

export default function AlarmsPage() {
  // --- CORE VIEW STATE ---
  const [leftPanelMode, setLeftPanelMode] = useState<"alarms" | "patrol">("alarms");
  const [canvasView, setCanvasView] = useState<"live" | "map">("live");
  const [rightPanelTab, setRightPanelTab] = useState<"action" | "controls" | "notes">("action");

  // --- ACTIVE SELECTION STATE ---
  const [activeSite, setActiveSite] = useState(MOCK_SITES[0]);
  const [activeAlarm, setActiveAlarm] = useState(MOCK_ALARMS[0]);
  const [activeCameraId, setActiveCameraId] = useState(MOCK_ALARMS[0].cameraId);
  const [activeCameraName, setActiveCameraName] = useState(MOCK_ALARMS[0].camName);

  // --- LIVE VIDEO STATE ---
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // 1. Fetch Stream URL whenever the active camera changes
  useEffect(() => {
    const fetchStream = async () => {
      // For this demo, we only have a real EEN token/ID for Marbella's Amenity Hall
      // If you click a fake camera, we'll just show the loading state
      if (activeCameraId !== "10054b8c") {
        setVideoUrl(null);
        return;
      }

      const token = localStorage.getItem(`een_token_${activeSite.name}`);
      if (!token) return;

      setIsVideoLoading(true);
      try {
        const response = await fetch('/api/een/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, siteName: activeSite.name, cameraId: activeCameraId })
        });

        const data = await response.json();
        if (response.ok && data.url) {
            setVideoUrl(data.url);
        } else {
            setVideoUrl(null);
        }
      } catch (err) {
        console.error("Stream Proxy Error:", err);
      } finally {
        setIsVideoLoading(false);
      }
    };

    fetchStream();
  }, [activeCameraId, activeSite.name]);

  // 2. Attach HLS.js when we get a valid URL
  useEffect(() => {
    if (videoUrl && videoRef.current) {
      const token = localStorage.getItem(`een_token_${activeSite.name}`);
      const proxiedVideoUrl = `/api/een/proxy?url=${encodeURIComponent(videoUrl)}&token=${encodeURIComponent(token || '')}`;

      if (Hls.isSupported()) {
        const hls = new Hls({
            xhrSetup: function(xhr, url) {
                if (url.includes('eagleeyenetworks.com')) {
                    xhr.open('GET', `/api/een/proxy?url=${encodeURIComponent(url)}&token=${encodeURIComponent(token || '')}`, true);
                }
            }
        });
        hls.loadSource(proxiedVideoUrl);
        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoRef.current?.play().catch(e => console.error("Autoplay blocked:", e));
        });
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = proxiedVideoUrl;
        videoRef.current.addEventListener('loadedmetadata', () => {
          videoRef.current?.play().catch(e => console.error("Autoplay blocked:", e));
        });
      }
    }
  }, [videoUrl, activeSite.name]);

  // Handler for clicking an alarm
  const handleAlarmClick = (alarm: any) => {
    setActiveAlarm(alarm);
    const site = MOCK_SITES.find(s => s.name === alarm.siteName) || MOCK_SITES[0];
    setActiveSite(site);
    setActiveCameraId(alarm.cameraId);
    setActiveCameraName(alarm.camName);
    setCanvasView("live");
  };

  // Handler for selecting a camera manually from the PIP row
  const handleCameraSelect = (camId: string, camName: string) => {
    setActiveCameraId(camId);
    setActiveCameraName(camName);
  };

  return (
    <div className="w-full h-full flex gap-6 p-6 relative bg-[#05070a]">
      
      {/* LEFT: TRIAGE & PATROL QUEUE */}
      <div className="w-80 flex flex-col gap-4 z-10 shrink-0">
        
        {/* Toggle Mode */}
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 backdrop-blur-md">
          <button onClick={() => setLeftPanelMode("alarms")} className={`flex-1 text-[10px] font-black tracking-widest py-2.5 rounded-lg transition-all ${leftPanel
