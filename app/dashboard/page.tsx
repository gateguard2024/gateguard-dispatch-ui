"use client";

import React from "react";

export default function DashboardPage() {
  return (
    <div className="w-full h-full p-8 overflow-y-auto custom-scrollbar">
      
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight drop-shadow-md">Executive Analytics</h1>
          <p className="text-slate-400 mt-2 font-medium">Real-time performance metrics across all monitored sites.</p>
        </div>
        <div className="flex gap-3">
           <div className="bg-white/5 border border-white/10 text-slate-300 px-4 py-2 rounded-xl text-sm font-bold flex items-center">
             <span>2026/03/19</span> <span className="mx-2">|</span> <span>2026/03/19</span>
           </div>
           <button className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-6 rounded-xl transition-all shadow-lg shadow-emerald-500/20 text-sm">
             Export Report
           </button>
        </div>
      </div>

      {/* KPI Row (Equivalent to the right side of Immix screen) */}
      <div className="grid grid-cols-4 gap-6 mb-6">
        {[
          { title: "Critical Events", val: "20", color: "text-rose-400" },
          { title: "Armed Sites", val: "5", color: "text-emerald-400" },
          { title: "Disarmed Sites", val: "2", color: "text-amber-400" },
          { title: "ECare Failed", val: "0", color: "text-slate-300" },
        ].map((stat, i) => (
          <div key={i} className="bg-white/5 backdrop-blur-lg border border-white/10 p-5 rounded-3xl shadow-xl flex items-center justify-between">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest w-20">{stat.title}</span>
            <span className={`text-5xl font-extrabold ${stat.color} drop-shadow-md`}>{stat.val}</span>
          </div>
        ))}
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-3 gap-6">
        
        {/* Average Alarm Response Time (Gauges) */}
        <div className="col-span-3 bg-white/5 backdrop-blur-lg border border-white/10 p-6 rounded-3xl shadow-xl">
           <h3 className="text-sm font-black text-slate-300 uppercase tracking-widest mb-6">Average Alarm Response Time</h3>
           <div className="flex justify-around items-center">
              {/* Fake CSS Gauges */}
              {[
                { label: "< 30 Seconds", pct: "71%", stroke: "stroke-rose-500" },
                { label: "< 60 Seconds", pct: "80%", stroke: "stroke-amber-500" },
                { label: "< 90 Seconds", pct: "85%", stroke: "stroke-yellow-500" },
                { label: "< 180 Seconds", pct: "95%", stroke: "stroke-emerald-500" },
              ].map((g, i) => (
                 <div key={i} className="flex flex-col items-center">
                    <div className="relative w-24 h-24 mb-3 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path className="stroke-slate-800" strokeWidth="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path className={`${g.stroke}`} strokeWidth="3" strokeDasharray={`${g.pct.replace('%','')} 100`} fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      </svg>
                      <span className="absolute text-lg font-bold text-white">{g.pct}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-500">{g.label}</span>
                 </div>
              ))}
           </div>
        </div>

        {/* Alarms By Hour (Area Chart) */}
        <div className="col-span-2 bg-white/5 backdrop-blur-lg border border-white/10 p-6 rounded-3xl shadow-xl flex flex-col min-h-[300px]">
           <h3 className="text-sm font-black text-slate-300 uppercase tracking-widest mb-4">Alarms By Hour <span className="text-emerald-400 text-xs ml-2">▼ 31%</span></h3>
           <div className="flex-1 border-b border-l border-white/10 relative flex items-end w-full pb-2 pl-2">
             {/* Fake Area Chart */}
             <svg className="absolute bottom-0 left-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
               <path d="M0 100 L0 50 Q 20 20, 40 60 T 80 40 T 100 30 L100 100 Z" fill="rgba(16,185,129,0.2)" />
               <path d="M0 50 Q 20 20, 40 60 T 80 40 T 100 30" fill="none" stroke="#10b981" strokeWidth="2" />
               <path d="M0 100 L0 70 Q 30 50, 50 70 T 90 20 T 100 50 L100 100 Z" fill="rgba(244,63,94,0.2)" />
               <path d="M0 70 Q 30 50, 50 70 T 90 20 T 100 50" fill="none" stroke="#f43f5e" strokeWidth="2" />
             </svg>
           </div>
           <div className="flex justify-between mt-3 text-[10px] text-slate-500 font-mono w-full">
             <span>12:00</span><span>02:00</span><span>04:00</span><span>06:00</span><span>08:00</span><span>10:00</span><span>12:00</span>
           </div>
        </div>

        {/* Alarms Per Operator (Bar Chart) */}
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 p-6 rounded-3xl shadow-xl flex flex-col">
           <h3 className="text-sm font-black text-slate-300 uppercase tracking-widest mb-6">Alarms Per Operator</h3>
           <div className="flex-1 flex items-end justify-around gap-2 mt-auto border-b border-white/10 pb-2">
              <div className="flex flex-col items-center w-full group">
                 <div className="w-full bg-blue-500/80 rounded-t-sm h-[80%] group-hover:bg-blue-400 transition-colors"></div>
                 <span className="text-[10px] text-slate-400 mt-2 text-center leading-tight">Russel<br/>Feldman</span>
              </div>
              <div className="flex flex-col items-center w-full group">
                 <div className="w-full bg-rose-500/80 rounded-t-sm h-[40%] group-hover:bg-rose-400 transition-colors"></div>
                 <span className="text-[10px] text-slate-400 mt-2 text-center leading-tight">Narendra<br/>Rawat</span>
              </div>
              <div className="flex flex-col items-center w-full group">
                 <div className="w-full bg-amber-500/80 rounded-t-sm h-[20%] group-hover:bg-amber-400 transition-colors"></div>
                 <span className="text-[10px] text-slate-400 mt-2 text-center leading-tight">Suyash<br/>Jajodia</span>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}
