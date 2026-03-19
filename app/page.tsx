"use client";

import React, { useState } from "react";

export default function MainApp() {
  // Navigation State
  const [currentView, setCurrentView] = useState("Alarms");

  return (
    <div className="flex flex-col h-screen bg-[#0A0D14] text-slate-300 font-sans overflow-hidden">
      
      {/* 1. GLOBAL TOP NAVIGATION */}
      <header className="flex items-center justify-between bg-[#121620] border-b border-slate-800/80 px-6 py-3 z-20 shadow-md">
        <div className="flex items-center space-x-8">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentView("Dashboard")}>
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-lg flex items-center justify-center font-extrabold text-white shadow-lg shadow-emerald-500/20">
              GG
            </div>
            <span className="text-xl font-bold text-white tracking-tight">GateGuard</span>
          </div>
          
          {/* Nav Buttons */}
          <nav className="hidden lg:flex space-x-1 bg-slate-800/50 p-1 rounded-full border border-slate-700/50">
            {["Dashboard", "Alarms", "Setup", "Reports"].map((item) => (
              <button 
                key={item}
                onClick={() => setCurrentView(item)}
                className={`px-5 py-1.5 text-sm font-semibold rounded-full transition-all ${
                  currentView === item 
                    ? "bg-emerald-500 text-white shadow-md" 
                    : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center space-x-5">
          <div className="flex items-center space-x-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-4 py-1.5 rounded-full text-sm font-bold animate-pulse">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>2 Active Alarms</span>
          </div>
          <div className="w-px h-6 bg-slate-700"></div>
          <div className="flex items-center space-x-3 cursor-pointer group">
            <div className="text-right">
              <div className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">Russel Feldman</div>
              <div className="text-xs text-slate-500">Admin / Dispatch</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-slate-600 overflow-hidden flex justify-center items-center font-bold text-white">
              RF
            </div>
          </div>
        </div>
      </header>

      {/* 2. DYNAMIC WORKSPACE (Changes based on Nav click) */}
      <main className="flex-1 overflow-hidden">
        {currentView === "Alarms" && <AlarmsView />}
        {currentView === "Dashboard" && <AnalyticsDashboardView />}
        {currentView === "Setup" && <SetupView />}
        {currentView === "Reports" && (
          <div className="flex items-center justify-center h-full text-slate-500 text-xl font-mono">
            Reports Module - Coming Soon
          </div>
        )}
      </main>
    </div>
  );
}

// ==========================================
// VIEW 1: ALARMS (The SOC Agent Interface)
// ==========================================
function AlarmsView() {
  const [activeTab, setActiveTab] = useState("Current Events");
  const [activeCamera, setActiveCamera] = useState("Main Gate");

  const tabs = ["Alarms", "Current Events", "Previous", "Arming", "Audit", "Maps"];
  const cameras = ["Amenity Hall", "Back Door", "Business Center", "Gym Camera", "Leasing Lobby", "Main Gate", "Pool"];

  return (
    <div className="flex h-full gap-4 p-4 overflow-hidden">
      {/* LEFT/CENTER WORKSPACE (Video & Data) */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        
        {/* SITE HEADER ROW */}
        <div className="flex justify-between items-center bg-[#121620] p-4 rounded-xl border border-slate-800 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
            <h1 className="text-xl font-bold text-white tracking-wide">Elevate Greene</h1>
            <span className="px-2 py-0.5 bg-slate-800 text-slate-400 text-xs rounded border border-slate-700">ID: SITE-8259</span>
          </div>
          <div className="flex space-x-2">
            <button className="bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 px-4 py-2 rounded-lg border border-slate-700 transition-colors">MultiView</button>
            <button className="bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 px-4 py-2 rounded-lg border border-slate-700 transition-colors">Park Event</button>
          </div>
        </div>

        {/* VIDEO ENGINE ROW */}
        <div className="flex h-[55%] gap-4">
          
          {/* Pre-Alarm Clip */}
          <div className="flex-1 flex flex-col bg-black rounded-xl border border-rose-500/40 relative overflow-hidden shadow-lg shadow-rose-900/10">
            <div className="absolute top-3 left-3 bg-rose-500 text-white text-[10px] font-bold px-3 py-1 rounded-full z-10 uppercase tracking-wider shadow-md">10s Pre-Alarm</div>
            <div className="flex-1 flex justify-center items-center text-slate-600 font-mono text-sm">
               <svg className="w-12 h-12 opacity-50 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
            </div>
          </div>

          {/* Camera Selector List */}
          <div className="w-56 flex flex-col bg-[#121620] rounded-xl border border-slate-800 overflow-hidden shadow-sm">
             <div className="p-3 border-b border-slate-800">
               <input type="text" placeholder="Search cameras..." className="w-full bg-[#0A0D14] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors" />
             </div>
             <div className="flex-1 overflow-y-auto p-2 space-y-1">
               {cameras.map(cam => (
                 <button 
                  key={cam} onClick={() => setActiveCamera(cam)}
                  className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg transition-all flex justify-between items-center ${activeCamera === cam ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'hover:bg-slate-800 text-slate-400 border border-transparent'}`}
                 >
                   {cam}
                   {activeCamera === cam && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
                 </button>
               ))}
             </div>
          </div>

          {/* Live View */}
          <div className="flex-1 flex flex-col bg-black rounded-xl border border-emerald-500/40 relative overflow-hidden shadow-lg shadow-emerald-900/10">
            <div className="absolute top-3 left-3 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-full z-10 uppercase tracking-wider flex items-center shadow-md">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse mr-2"></span> LIVE: {activeCamera}
            </div>
            <div className="flex-1 flex flex-col justify-center items-center text-emerald-500/50">
               <div className="w-12 h-12 border-4 border-slate-800 border-t-emerald-500 rounded-full animate-spin mb-3"></div>
               <span className="text-sm font-mono tracking-widest">CONNECTING WEB RTC</span>
            </div>
          </div>
        </div>

        {/* BOTTOM TABBED PANEL */}
        <div className="flex-1 flex flex-col bg-[#121620] rounded-xl border border-slate-800 shadow-sm overflow-hidden">
           <div className="flex p-2 gap-1 bg-[#0f121a] border-b border-slate-800 overflow-x-auto">
             {tabs.map(tab => (
               <button 
                key={tab} onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${activeTab === tab ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
               >
                 {tab}
               </button>
             ))}
           </div>
           
           <div className="flex-1 overflow-y-auto">
             {activeTab === "Current Events" && (
               <table className="w-full text-left text-sm">
                 <thead className="bg-[#0f121a] text-slate-500 sticky top-0 text-xs uppercase tracking-wider">
                   <tr>
                     <th className="px-6 py-3 font-semibold">Time</th>
                     <th className="px-6 py-3 font-semibold">Event Details</th>
                     <th className="px-6 py-3 font-semibold">Camera Source</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-800/50">
                   {[
                     { time: "4:57 PM", det: "Motion Detected - Main Gate", cam: "Main Gate", status: "active" },
                     { time: "4:42 PM", det: "Motion Detected - Leasing Lobby", cam: "Leasing Lobby", status: "queued" },
                   ].map((row, i) => (
                     <tr key={i} className={`group transition-colors ${row.status === 'active' ? 'bg-rose-500/5 hover:bg-rose-500/10' : 'hover:bg-slate-800/50'}`}>
                       <td className={`px-6 py-4 whitespace-nowrap font-mono text-xs ${row.status === 'active' ? 'text-rose-400' : 'text-slate-400'}`}>{row.time}</td>
                       <td className="px-6 py-4 text-slate-200 font-medium">{row.det}</td>
                       <td className="px-6 py-4 text-slate-400">{row.cam}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             )}
           </div>
        </div>
      </div>

      {/* RIGHT ACTION PANEL */}
      <div className="w-80 flex flex-col bg-[#121620] rounded-xl border border-slate-800 shadow-sm overflow-hidden shrink-0">
        <div className="p-5 bg-gradient-to-r from-slate-800 to-[#121620] border-b border-slate-800">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Command Center</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div className="bg-[#0A0D14] rounded-xl border border-slate-800 p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
            <h3 className="text-[10px] font-extrabold text-amber-500 uppercase tracking-widest mb-3">Strict SOPs</h3>
            <ul className="text-xs text-slate-300 space-y-2 list-decimal pl-4 marker:text-slate-600 font-medium">
              <li>Verify if vehicle is a marked Police, Fire, or EMS.</li>
              <li>If emergency, immediately click 'OPEN GATE'.</li>
              <li>If guest, verify name via 2-way audio.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <button className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all text-sm border border-emerald-400/50">
              Open Main Gate
            </button>
            <button className="w-full bg-[#1e293b] hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-xl transition-all text-sm border border-slate-700 hover:border-indigo-400 shadow-sm">
              Push-to-Talk
            </button>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <textarea 
              className="w-full bg-[#0A0D14] border border-slate-700 rounded-xl p-3 text-sm text-slate-200 focus:border-blue-500 focus:outline-none mb-3 resize-none"
              rows={4} placeholder="Log verified details here..."
            ></textarea>
            <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all text-sm">
              Log Event & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// VIEW 2: DASHBOARD (Analytics Overview)
// ==========================================
function AnalyticsDashboardView() {
  return (
    <div className="flex-1 h-full overflow-y-auto p-6 space-y-6 bg-[#0A0D14]">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">System Overview</h1>
          <p className="text-slate-400 mt-1">Real-time performance metrics for all monitored sites.</p>
        </div>
        <button className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2 px-4 rounded-lg border border-slate-700 transition-all text-sm">
          Download Report (PDF)
        </button>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { title: "Total Alarms (24h)", val: "1,204", change: "+12%", color: "text-blue-400" },
          { title: "Avg Response Time", val: "14s", change: "-2s", color: "text-emerald-400" },
          { title: "Active Sites", val: "42", change: "+1", color: "text-purple-400" },
          { title: "Dispatched Police", val: "3", change: "Same", color: "text-rose-400" },
        ].map((stat, i) => (
          <div key={i} className="bg-[#121620] p-6 rounded-xl border border-slate-800 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{stat.title}</span>
            <div className="flex items-end justify-between mt-4">
              <span className={`text-4xl font-extrabold ${stat.color}`}>{stat.val}</span>
              <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">{stat.change}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-3 gap-4 h-[400px]">
        <div className="col-span-2 bg-[#121620] rounded-xl border border-slate-800 p-6 flex flex-col relative overflow-hidden">
           <h3 className="text-sm font-bold text-white mb-4">Alarm Volume (7 Days)</h3>
           <div className="flex-1 border-b border-l border-slate-700 relative flex items-end">
             {/* Fake Line Chart Representation */}
             <svg className="absolute bottom-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
               <path d="M0 80 Q 20 20, 40 60 T 80 40 T 100 30" fill="none" stroke="#3b82f6" strokeWidth="2" />
               <path d="M0 90 Q 30 50, 50 70 T 90 20 T 100 50" fill="none" stroke="#10b981" strokeWidth="2" opacity="0.5" />
             </svg>
           </div>
           <div className="flex justify-between mt-2 text-[10px] text-slate-500 uppercase font-mono">
             <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
           </div>
        </div>

        <div className="bg-[#121620] rounded-xl border border-slate-800 p-6">
           <h3 className="text-sm font-bold text-white mb-4">Event Resolution Types</h3>
           <div className="space-y-4">
             {[
               { label: "Authorized Access", pct: "65%", bg: "bg-emerald-500" },
               { label: "False Alarm / Ignored", pct: "20%", bg: "bg-slate-500" },
               { label: "Emergency Dispatch", pct: "10%", bg: "bg-rose-500" },
               { label: "Maintenance Required", pct: "5%", bg: "bg-amber-500" },
             ].map((item, i) => (
               <div key={i}>
                 <div className="flex justify-between text-xs mb-1">
                   <span className="text-slate-300">{item.label}</span>
                   <span className="text-slate-500 font-mono">{item.pct}</span>
                 </div>
                 <div className="w-full bg-slate-800 rounded-full h-1.5"><div className={`${item.bg} h-1.5 rounded-full`} style={{ width: item.pct }}></div></div>
               </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// VIEW 3: SETUP (Admin Configuration)
// ==========================================
function SetupView() {
  return (
    <div className="flex-1 h-full overflow-y-auto p-10 bg-[#0A0D14] flex flex-col items-center">
      
      <div className="w-full max-w-5xl bg-[#121620] rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        
        <div className="bg-slate-800/30 p-6 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white tracking-wide">SETUP</h2>
          <p className="text-sm text-slate-400 mt-1">What would you like to do?</p>
        </div>

        <div className="grid grid-cols-4 gap-6 p-8">
          
          {/* Column 1: Sites */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m3-4h1m-1 4h1m-5 8h8"></path></svg></div>
              <h3 className="font-bold text-slate-200 text-lg uppercase tracking-wider">Sites</h3>
            </div>
            <ul className="space-y-3">
              <li className="text-emerald-400 hover:text-emerald-300 text-sm font-medium cursor-pointer flex items-center"><span className="mr-2">⊕</span> Add a Site</li>
              <li className="text-amber-400 hover:text-amber-300 text-sm font-medium cursor-pointer flex items-center"><span className="mr-2">✎</span> Edit Sites</li>
              <li className="text-blue-400 hover:text-blue-300 text-sm font-medium cursor-pointer flex items-center"><span className="mr-2">🚪</span> Edit Access Control</li>
              <li className="text-emerald-400 hover:text-emerald-300 text-sm font-medium cursor-pointer flex items-center"><span className="mr-2">⊕</span> Data Import</li>
            </ul>
          </div>

          {/* Column 2: Users */}
          <div className="space-y-4 border-l border-slate-800/80 pl-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg></div>
              <h3 className="font-bold text-slate-200 text-lg uppercase tracking-wider">Users</h3>
            </div>
            <ul className="space-y-3">
              <li className="text-emerald-400 hover:text-emerald-300 text-sm font-medium cursor-pointer flex items-center"><span className="mr-2">⊕</span> Add a User</li>
              <li className="text-amber-400 hover:text-amber-300 text-sm font-medium cursor-pointer flex items-center"><span className="mr-2">✎</span> Edit Users</li>
              <li className="text-blue-400 hover:text-blue-300 text-sm font-medium cursor-pointer flex items-center"><span className="mr-2">🔗</span> Link SSO</li>
            </ul>
          </div>

          {/* Column 3: Scripts (SOPs) */}
          <div className="space-y-4 border-l border-slate-800/80 pl-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-rose-500/10 rounded-lg text-rose-400"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg></div>
              <h3 className="font-bold text-slate-200 text-lg uppercase tracking-wider">Scripts</h3>
            </div>
            <ul className="space-y-3">
              <li className="text-emerald-400 hover:text-emerald-300 text-sm font-medium cursor-pointer flex items-center"><span className="mr-2">⊕</span> Add a Script</li>
              <li className="text-amber-400 hover:text-amber-300 text-sm font-medium cursor-pointer flex items-center"><span className="mr-2">✎</span> Edit Scripts</li>
            </ul>
          </div>

          {/* Column 4: Settings */}
          <div className="space-y-4 border-l border-slate-800/80 pl-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg></div>
              <h3 className="font-bold text-slate-200 text-lg uppercase tracking-wider">Settings</h3>
            </div>
            <ul className="space-y-3">
              <li className="text-amber-400 hover:text-amber-300 text-sm font-medium cursor-pointer flex items-center"><span className="mr-2">✎</span> Edit Settings</li>
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
}
