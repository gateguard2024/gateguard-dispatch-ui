"use client";

import React, { useState } from "react";

// --- MOCK DATA ---
const mockAlarms = [
  {
    eventId: "EVT-9901",
    timestamp: "2026-03-19T15:30:00Z",
    status: "active",
    site: {
      siteId: "SITE-DUNWOODY-01",
      name: "Dunwoody Village",
      address: "123 Main St, Dunwoody, GA",
      managerContact: "Angela (555-0199)",
    },
    trigger: {
      type: "Camera Motion",
      cameraName: "Main Entrance Gate",
    },
    sops: [
      "1. Verify if vehicle is a marked Dunwoody Police, Fire, or EMS.",
      "2. If marked emergency vehicle, immediately click 'OPEN GATE'.",
      "3. If standard guest, verify name via 2-way audio.",
      "4. Log all forced entries with vehicle make/model.",
    ],
  },
  {
    eventId: "EVT-9902",
    timestamp: "2026-03-19T15:35:12Z",
    status: "active",
    site: {
      siteId: "SITE-AVANA-02",
      name: "Avana Chase",
      address: "456 Perimeter Ctr, Atlanta, GA",
      managerContact: "Property Manager (555-0200)",
    },
    trigger: {
      type: "Gate Forced Open",
      cameraName: "Exit Gate",
    },
    sops: [
      "1. Check for tailgating vehicle.",
      "2. Log license plate if visible.",
      "3. Dispatch courtesy patrol if gate remains stuck open.",
    ],
  },
];

export default function Dashboard() {
  // State to hold the currently selected alarm
  const [activeAlarm, setActiveAlarm] = useState(mockAlarms[0]);
  const [notes, setNotes] = useState("");

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 font-sans overflow-hidden">
      
      {/* LEFT PANEL: ALARM QUEUE (25% width) */}
      <div className="w-1/4 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 bg-gray-900 border-b border-gray-700">
          <h2 className="text-lg font-bold text-white">Active Alarms</h2>
          <p className="text-sm text-gray-400">{mockAlarms.length} in queue</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {mockAlarms.map((alarm) => (
            <div
              key={alarm.eventId}
              onClick={() => setActiveAlarm(alarm)}
              className={`p-4 rounded-lg cursor-pointer transition-colors ${
                activeAlarm.eventId === alarm.eventId
                  ? "bg-blue-600 border border-blue-400"
                  : "bg-gray-700 hover:bg-gray-600 border border-transparent"
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="font-semibold">{alarm.site.name}</span>
                <span className="text-xs text-red-300 bg-red-900/50 px-2 py-1 rounded">
                  {new Date(alarm.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm text-gray-300 mt-1">{alarm.trigger.type}</p>
              <p className="text-xs text-gray-400">{alarm.trigger.cameraName}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CENTER PANEL: VIDEO ENGINE (50% width) */}
      <div className="w-2/4 flex flex-col bg-black">
        <div className="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">{activeAlarm.site.name} - {activeAlarm.trigger.cameraName}</h1>
            <p className="text-sm text-gray-400">{activeAlarm.site.address}</p>
          </div>
          <span className="bg-red-600 animate-pulse text-white px-3 py-1 rounded-full text-sm font-bold">
            LIVE ALARM
          </span>
        </div>
        
        <div className="flex-1 p-4 flex flex-col space-y-4 justify-center items-center bg-gray-900">
          {/* Mock Video Players */}
          <div className="w-full aspect-video bg-gray-800 border border-gray-700 rounded-lg flex items-center justify-center relative shadow-lg">
            <span className="text-gray-500 absolute top-4 left-4 font-mono">LIVE FEED (Eagle Eye UI Placeholder)</span>
            <div className="w-16 h-16 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
          
          <div className="w-full aspect-video bg-gray-800 border border-gray-700 rounded-lg flex items-center justify-center relative shadow-lg">
            <span className="text-gray-500 absolute top-4 left-4 font-mono">10-SECOND CLIP (Pre-Event Placeholder)</span>
            <svg className="w-12 h-12 text-gray-600" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: SOPs & ACTIONS (25% width) */}
      <div className="w-1/4 bg-gray-800 border-l border-gray-700 flex flex-col">
        <div className="p-4 bg-gray-900 border-b border-gray-700">
          <h2 className="text-lg font-bold">Action Panel</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* SOPs */}
          <div className="bg-gray-700 rounded-lg p-4 shadow-sm border border-gray-600">
            <h3 className="text-sm font-bold text-yellow-400 uppercase mb-2 flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              Standard Operating Procedures
            </h3>
            <ul className="text-sm text-gray-200 space-y-2">
              {activeAlarm.sops.map((sop, idx) => (
                <li key={idx} className="leading-relaxed">{sop}</li>
              ))}
            </ul>
          </div>

          {/* Quick Actions */}
          <div className="space-y-3">
            <button className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-all flex justify-center items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"></path></svg>
              OPEN GATE (Brivo)
            </button>
            <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-all flex justify-center items-center">
               <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
              Push to Talk (2-Way)
            </button>
          </div>

          {/* Incident Logging */}
          <div className="pt-4 border-t border-gray-700">
            <label className="block text-sm font-medium text-gray-300 mb-2">Resolution Notes</label>
            <textarea 
              className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none mb-3"
              rows={4}
              placeholder="e.g., Verified Dunwoody PD unit #402. Opened gate."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            ></textarea>
            <button className="w-full bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
              Log to Brivo & Close Alarm
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
