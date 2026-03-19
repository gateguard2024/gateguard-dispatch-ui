"use client";

import React, { useState } from "react";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("Current Events");
  const [activeCamera, setActiveCamera] = useState("Main Gate");

  const tabs = ["Alarms", "Current Events", "Previous", "Arming", "Audit", "Maps"];
  const cameras = ["Amenity Hall", "Back Door", "Business Center", "Gym Camera", "Leasing Lobby", "Main Gate", "Pool"];

  return (
    <div className="flex flex-col h-screen bg-[#0A0D14] text-slate-300 font-sans overflow-hidden">
      
      {/* 1. MODERN TOP NAVIGATION */}
      <header className="flex items-center justify-between bg-[#121620] border-b border-slate-800/80 px-6 py-3 z-10">
        <div className="flex items-center space-x-8">
          <div className="flex items-center space-x-3 cursor-pointer">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-lg flex items-center justify-center font-extrabold text-white shadow-lg shadow-emerald-500/20">
              GG
            </div>
            <span className="text-xl font-bold text-white tracking-tight">GateGuard</span>
          </div>
          
          <nav className="hidden lg:flex space-x-1 bg-slate-800/50 p-1 rounded-full border border-slate-700/50">
            {["Dashboard", "Alarms", "Setup", "Reports"].map((item) => (
              <button 
                key={item}
                className={`px-5 py-1.5 text-sm font-semibold rounded-full transition-all ${item === "Alarms" ? "bg-emerald-500 text-white shadow-md" : "text-slate-400 hover:text-white hover:bg-slate-700/50"}`}
              >
                {item}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center space-x-5">
          <div className="flex items-center space-x-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-4 py-1.5 rounded-full text-sm font-bold animate-pulse">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>2 Active</span>
          </div>
          <div className="w-px h-6 bg-slate-700"></div>
          <div className="flex items-center space-x-3 cursor-pointer group">
            <div className="text-right">
              <div className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">Russel Feldman</div>
              <div className="text-xs text-slate-500">Dispatch Agent</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-slate-600 overflow-hidden">
              {/* Avatar Placeholder */}
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Russel" alt="Avatar" />
            </div>
          </div>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE WITH FLOATING CARDS */}
      <main className="flex-1 flex gap-4 p-4 overflow-hidden">
        
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
              {["MultiView", "Park Event"].map((btn) => (
                <button key={btn} className="bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 px-4 py-2 rounded-lg border border-slate-700 transition-colors">
                  {btn}
                </button>
              ))}
            </div>
          </div>

          {/* VIDEO ENGINE ROW */}
          <div className="flex h-[55%] gap-4">
            
            {/* Pre-Alarm Clip */}
            <div className="flex-1 flex flex-col bg-black rounded-xl border border-rose-500/40 relative overflow-hidden shadow-lg shadow-rose-900/10">
              <div className="absolute top-3 left-3 bg-rose-500 text-white text-[10px] font-bold px-3 py-1 rounded-full z-10 uppercase tracking-wider shadow-md">
                10s Pre-Alarm
              </div>
              <div className="flex-1 flex justify-center items-center text-slate-600 font-mono text-sm">
                 <svg className="w-12 h-12 opacity-50 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
              </div>
              <div className="bg-[#121620]/90 backdrop-blur h-10 flex items-center px-4 text-white border-t border-rose-500/30 space-x-4 text-xs">
                <span className="text-slate-400 font-bold cursor-pointer hover:text-white">▶ PLAY</span>
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="w-1/3 h-full bg-rose-500"></div></div>
                <span className="font-mono text-slate-400">00:00 / 00:10</span>
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
                    key={cam} 
                    onClick={() => setActiveCamera(cam)}
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
              <div className="absolute top-3 right-3 flex space-x-2 z-10">
                <button className="bg-black/50 text-white p-1.5 rounded hover:bg-black/80 backdrop-blur"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg></button>
              </div>
              <div className="flex-1 flex flex-col justify-center items-center text-emerald-500/50">
                 <div className="w-12 h-12 border-4 border-slate-800 border-t-emerald-500 rounded-full animate-spin mb-3"></div>
                 <span className="text-sm font-mono tracking-widest">CONNECTING WEB RTC</span>
              </div>
            </div>
          </div>

          {/* BOTTOM TABBED PANEL */}
          <div className="flex-1 flex flex-col bg-[#121620] rounded-xl border border-slate-800 shadow-sm overflow-hidden">
             {/* Tab Row */}
             <div className="flex p-2 gap-1 bg-[#0f121a] border-b border-slate-800 overflow-x-auto">
               {tabs.map(tab => (
                 <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${activeTab === tab ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
                 >
                   {tab}
                 </button>
               ))}
             </div>
             
             {/* Data Area */}
             <div className="flex-1 overflow-y-auto">
               {activeTab === "Current Events" && (
                 <table className="w-full text-left text-sm">
                   <thead className="bg-[#0f121a] text-slate-500 sticky top-0 text-xs uppercase tracking-wider">
                     <tr>
                       <th className="px-6 py-3 font-semibold">Time</th>
                       <th className="px-6 py-3 font-semibold">Event Details</th>
                       <th className="px-6 py-3 font-semibold">Camera Source</th>
                       <th className="px-6 py-3 font-semibold text-right">Action</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-800/50">
                     {[
                       { time: "4:57 PM", det: "Motion Detected - Main Gate", cam: "Main Gate", status: "active" },
                       { time: "4:42 PM", det: "Motion Detected - Leasing Lobby", cam: "Leasing Lobby", status: "queued" },
                       { time: "4:30 PM", det: "Motion Detected - Gym Camera", cam: "Gym Camera", status: "queued" },
                     ].map((row, i) => (
                       <tr key={i} className={`group transition-colors ${row.status === 'active' ? 'bg-rose-500/5 hover:bg-rose-500/10' : 'hover:bg-slate-800/50'}`}>
                         <td className={`px-6 py-4 whitespace-nowrap font-mono text-xs ${row.status === 'active' ? 'text-rose-400' : 'text-slate-400'}`}>{row.time}</td>
                         <td className="px-6 py-4 text-slate-200 font-medium">{row.det}</td>
                         <td className="px-6 py-4 text-slate-400">{row.cam}</td>
                         <td className="px-6 py-4 text-right">
                           <button className="text-emerald-400 text-xs font-bold hover:text-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity">View Details →</button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               )}
               {activeTab !== "Current Events" && (
                 <div className="flex h-full items-center justify-center text-slate-600">
                   {activeTab} Data Feed
                 </div>
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
            
            {/* Standard Operating Procedures Card */}
            <div className="bg-[#0A0D14] rounded-xl border border-slate-800 p-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
              <h3 className="text-[10px] font-extrabold text-amber-500 uppercase tracking-widest mb-3 flex items-center">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                Strict SOPs
              </h3>
              <ul className="text-xs text-slate-300 space-y-2 list-decimal pl-4 marker:text-slate-600 font-medium">
                <li>Verify if vehicle is a marked Police, Fire, or EMS.</li>
                <li>If marked emergency vehicle, immediately click 'OPEN GATE'.</li>
                <li>If standard guest, verify name via 2-way audio.</li>
              </ul>
            </div>

            {/* Hard Actions */}
            <div className="space-y-3">
              <button className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex justify-center items-center text-sm border border-emerald-400/50">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"></path></svg>
                Open Main Gate
              </button>
              <button className="w-full bg-[#1e293b] hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-xl transition-all flex justify-center items-center text-sm border border-slate-700 hover:border-indigo-400 shadow-sm hover:shadow-indigo-500/20">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                Push-to-Talk
              </button>
            </div>

            {/* Resolution Form */}
            <div className="pt-4 border-t border-slate-800">
              <label className="block text-[10px] font-extrabold text-slate-500 mb-2 uppercase tracking-widest">Resolution Notes</label>
              <textarea 
                className="w-full bg-[#0A0D14] border border-slate-700 rounded-xl p-3 text-sm text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none mb-3 resize-none transition-all placeholder:text-slate-600"
                rows={4}
                placeholder="Log verified details here. This will sync to Brivo and email the property manager."
              ></textarea>
              <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all text-sm">
                Log Event & Close
              </button>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
