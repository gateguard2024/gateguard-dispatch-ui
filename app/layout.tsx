// app/layout.tsx
// GateGuard OS — Root Layout with Clerk auth + role-based navigation
//
// Role access:
//   agent      → Dashboard, Alarms, Cameras, Reports
//   supervisor → All agent routes + Setup (view only — enforced in setup page)
//   admin      → Full access including Setup write operations

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { ClerkProvider, UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GateGuard OS | Monitoring Station",
  description: "Next-Gen Video Management & Access Control",
};

type UserRole = "admin" | "supervisor" | "agent";

const NAV_ITEMS = [
  {
    label: "DASHBOARD",
    path: "/dashboard",
    roles: ["admin", "supervisor", "agent"] as UserRole[],
    icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z",
  },
  {
    label: "ALARMS",
    path: "/alarms",
    roles: ["admin", "supervisor", "agent"] as UserRole[],
    icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  },
  {
    label: "CAMERAS",
    path: "/cameras",
    roles: ["admin", "supervisor", "agent"] as UserRole[],
    icon: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
  },
  {
    label: "PATROL",
    path: "/patrol",
    roles: ["admin", "supervisor", "agent"] as UserRole[],
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  },
  {
    label: "REPORTS",
    path: "/reports",
    roles: ["admin", "supervisor", "agent"] as UserRole[],
    icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
  {
    label: "SETUP",
    path: "/setup",
    roles: ["admin", "supervisor"] as UserRole[],
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
  },
];

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "ADMIN",
  supervisor: "SUPERVISOR",
  agent: "AGENT",
};

const ROLE_COLOR: Record<UserRole, string> = {
  admin: "text-indigo-400",
  supervisor: "text-amber-400",
  agent: "text-slate-500",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const role: UserRole = (user?.publicMetadata?.role as UserRole) ?? "agent";
  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(role));
  const displayName =
    user?.firstName ??
    user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ??
    "Operator";

  return (
    <ClerkProvider>
      <html lang="en" className="h-full bg-[#030406] text-slate-200 antialiased">
        <body className={`${inter.className} h-full overflow-hidden flex`}>

          {/* SIDEBAR */}
          <aside className="w-24 lg:w-[104px] flex flex-col items-center py-6 bg-[#0a0c10] border-r border-white/5 z-50 shadow-[10px_0_30px_rgba(0,0,0,0.5)] shrink-0">

            {/* Logo */}
            <div className="mb-10 w-full flex justify-center">
              <Link href="/dashboard">
                <img
                  src="/logo.png"
                  alt="GateGuard"
                  className="w-14 h-14 object-contain rounded-[14px] hover:opacity-90 transition-opacity"
                />
              </Link>
            </div>

            {/* Nav — filtered by role */}
            <nav className="flex-1 flex flex-col gap-6 w-full px-3">
              {visibleNav.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  className="group flex flex-col items-center gap-2 transition-all w-full"
                >
                  <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-transparent border border-transparent group-hover:bg-indigo-600/10 group-hover:border-indigo-500/30 group-hover:text-indigo-400 transition-all text-slate-500">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                    </svg>
                  </div>
                  <span className="text-[8px] font-black tracking-widest text-slate-600 group-hover:text-indigo-400 transition-colors uppercase">
                    {item.label}
                  </span>
                </Link>
              ))}
            </nav>

            {/* User — real identity from Clerk */}
            <div className="mt-auto flex flex-col items-center gap-2 w-full px-3">
              <UserButton
                afterSignOutUrl="/sign-in"
                appearance={{
                  elements: {
                    avatarBox: "w-10 h-10 border-2 border-white/10 hover:border-indigo-500 transition-all rounded-full",
                  },
                }}
              />
              <span className="text-[8px] font-black tracking-widest text-slate-500 uppercase text-center truncate w-full">
                {displayName}
              </span>
              <span className={`text-[7px] font-bold tracking-widest uppercase ${ROLE_COLOR[role]}`}>
                {ROLE_LABEL[role]}
              </span>
            </div>
          </aside>

          {/* MAIN */}
          <main className="flex-1 h-full overflow-hidden relative bg-[#030406]">
            {children}
          </main>

        </body>
      </html>
    </ClerkProvider>
  );
}
