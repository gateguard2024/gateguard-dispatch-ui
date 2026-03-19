"use client";

import React from "react";

export default function DashboardPage() {
  return (
    <div className="w-full h-full p-8 overflow-y-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight drop-shadow-md">System Overview</h1>
          <p className="text-slate-400 mt-2 font-medium">Real-time performance metrics for all monitored sites.</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {[
          { title: "Total Alarms (24h)", val: "1,204", color: "text-blue-400" },
          { title: "Avg Response Time", val: "14s", color: "text-emerald-400" },
          { title: "Active Sites", val: "42", color: "text-purple-400" },
          { title: "Dispatched Police", val: "3", color: "text-rose-400" },
        ].map((stat, i) => (
          <div key={i} className="bg-white/5 backdrop-blur-lg border border-white/10 p-6 rounded-3xl shadow-xl flex flex-col justify-between hover:bg-white/10 transition-colors">
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{stat.title}</span>
            <div className="mt-6">
              <span className={`text-5xl font-extrabold ${stat.color} drop-shadow-md`}>{stat.val}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
