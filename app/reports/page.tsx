"use client";
import React from "react";

export default function ReportsPage() {
  return (
    <div className="w-full h-full flex flex-col p-4 lg:p-6 bg-[#030406] text-white font-sans overflow-hidden">
      <div className="flex justify-between items-center mb-6 bg-[#0a0c10] border border-white/5 rounded-[2rem] p-6 backdrop-blur-md shadow-2xl">
        <div>
          <h1 className="text-2xl font-black tracking-tighter">INCIDENT REPORTS</h1>
          <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-[0.2em] mt-1">Audit Logs & Archives</p>
        </div>
      </div>
      <div className="flex-1 bg-[#0a0c10] border border-white/5 rounded-[3rem] shadow-inner flex items-center justify-center flex-col gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Loading Supabase Audit Logs...</span>
      </div>
    </div>
  );
}
