import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "GateGuard OS | Dispatch",
  description: "Next-Generation SOC Interface",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#05070a] to-black text-slate-200 font-sans overflow-hidden h-screen flex flex-col">
        
        {/* GLOBAL NAVIGATION BAR */}
        <header className="w-full flex items-center justify-between px-6 py-4 z-50 bg-black/20 backdrop-blur-md border-b border-white/5">
          <div className="flex items-center space-x-8">
            
            {/* Custom GateGuard Logo */}
            <Link href="/" className="flex items-center space-x-3 cursor-pointer group">
              <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.2)] group-hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] transition-all bg-white/5">
                {/* Ensure Logo.jp2 is in your /public folder! */}
                <img src="/Logo.jp2" alt="GateGuard Logo" className="w-full h-full object-cover" />
              </div>
              <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-widest">GateGuard</span>
            </Link>
            
            {/* Global Links */}
            <nav className="hidden lg:flex space-x-2 bg-white/5 border border-white/10 p-1.5 rounded-2xl">
              <Link href="/dashboard" className="px-6 py-1.5 text-sm font-bold rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all">Dashboard</Link>
              <Link href="/alarms" className="px-6 py-1.5 text-sm font-bold rounded-xl text-white bg-gradient-to-r from-emerald-500/80 to-teal-500/80 shadow-lg shadow-emerald-500/20 transition-all">Alarms</Link>
              <Link href="/setup" className="px-6 py-1.5 text-sm font-bold rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all">Setup</Link>
            </nav>
          </div>

          <div className="flex items-center space-x-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600/50 flex items-center justify-center font-bold text-white shadow-lg cursor-pointer hover:border-emerald-500/50 transition-colors">
              RF
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="flex-1 relative w-full h-full">
          {children}
        </main>

      </body>
    </html>
  );
}
