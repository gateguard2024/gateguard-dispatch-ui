// app/sign-in/[[...sign-in]]/page.tsx
// GateGuard sign-in page — Clerk hosted UI styled to match the platform

import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-[#030406] flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <img
          src="/logo.png"
          alt="GateGuard"
          className="w-16 h-16 object-contain rounded-2xl"
        />
        <div className="text-center">
          <h1 className="text-sm font-bold text-white tracking-widest uppercase">
            GateGuard OS
          </h1>
          <p className="text-[11px] text-slate-600 mt-0.5 tracking-wider">
            Security Operations Center
          </p>
        </div>
      </div>

      {/* Clerk sign-in widget */}
      <SignIn
        appearance={{
          variables: {
            colorPrimary: "#6366f1",
            colorBackground: "#0a0c10",
            colorText: "#e2e8f0",
            colorTextSecondary: "#64748b",
            colorInputBackground: "#0d0f16",
            colorInputText: "#e2e8f0",
            borderRadius: "6px",
            fontFamily: "inherit",
          },
          elements: {
            card: "shadow-2xl border border-white/[0.06] bg-[#0a0c10]",
            headerTitle: "text-white font-semibold tracking-tight",
            headerSubtitle: "text-slate-500",
            socialButtonsBlockButton: "border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] text-slate-300",
            dividerLine: "bg-white/[0.06]",
            dividerText: "text-slate-600",
            formFieldLabel: "text-slate-500 text-[10px] uppercase tracking-widest font-semibold",
            formFieldInput: "bg-black/20 border-white/[0.08] text-white focus:border-indigo-500/60",
            formButtonPrimary: "bg-indigo-600 hover:bg-indigo-500 text-white font-medium",
            footerActionLink: "text-indigo-400 hover:text-indigo-300",
          },
        }}
        redirectUrl="/dashboard"
      />

      <p className="mt-6 text-[10px] text-slate-700">
        Access is restricted to authorized GateGuard personnel only.
      </p>
    </div>
  );
}
