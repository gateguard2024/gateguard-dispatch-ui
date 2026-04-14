import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GateGuard Dispatch | Infrastructure Hub",
  description: "Enterprise SOC Operations Center",
};

// --- NAVIGATION CONFIG ---
const NAV_ITEMS = [
  { label: "SOC DECK", path: "/alarms", icon: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" },
  { label: "SITE MAPS", path: "/map", icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 9m0 8V9m0 0L9 7" },
  { label: "INFRASTRUCTURE", path: "/setup", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-[#030406] text-slate-200 antialiased">
      <body className={`${inter.className} h-full overflow-hidden`}>
        
        {/* --- GLOBAL APP WRAPPER --- */}
        <div className="flex h-screen w-screen p-4 lg:p-6 gap-6 overflow-hidden">
          
          {/* 📱 PERSISTENT SIDEBAR: The "Hardware Control" Panel */}
          <aside className="w-24 lg:w-28 flex flex-col items-center py-8 bg-[#0a0c10] border border-white/5 rounded-[2.5rem] shadow-2xl shrink-0">
            {/* BRANDING */}
            <div className="mb-12">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-900/40">
                <div className="w-5 h-5 border-2 border-white rounded-sm" />
              </div>
            </div>

            {/* NAV LINKS */}
            <nav className="flex-1 flex flex-col gap-8">
              {NAV_ITEMS.map((item) => (
                <Link 
                  key={item.path} 
                  href={item.path}
                  className="group flex flex-col items-center gap-2 transition-all"
                >
                  <div className="p-4 rounded-2xl bg-white/5 border border-transparent group-hover:bg-indigo-600/10 group-hover:border-indigo-500/30 group-hover:text-indigo-400 transition-all text-slate-500">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                    </svg>
                  </div>
                  <span className="text-[9px] font-black tracking-widest text-slate-600 group-hover:text-indigo-400 transition-colors">
                    {item.label}
                  </span>
                </Link>
              ))}
            </nav>

            {/* BOTTOM STATUS */}
            <div className="flex flex-col items-center gap-4">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]" />
               <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <div className="w-1 h-1 bg-slate-600 rounded-full" />
               </div>
            </div>
          </aside>

          {/* 🏗️ MAIN CONTENT AREA */}
          <main className="flex-1 flex flex-col overflow-hidden relative">
            {/* The Page content injects here */}
            {children}

            {/* GLOBAL OVERLAYS (Optional: Notifications, etc) */}
            <div className="fixed bottom-10 right-10 pointer-events-none">
                <div className="bg-[#0a0c10]/90 backdrop-blur-xl border border-white/5 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-4 duration-1000">
                  <div className="w-2 h-2 rounded-full bg-indigo-500" />
                  <span className="text-[10px] font-black tracking-widest text-slate-400">ENCRYPTED LINK ACTIVE</span>
                </div>
            </div>
          </main>

        </div>
      </body>
    </html>
  );
}
