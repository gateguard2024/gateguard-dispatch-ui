"use client";

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { eagleEyeService } from '@/services/eagleEyeService';

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // This is 'Pegasus Properties - Marbella Place'

    if (code && state) {
      console.log(`📡 Handshake Passport detected for: ${state}`);
      
      // We pass the code and the 'state' (site name) to our server
      // Our server will: 1. Exchange the code 2. Save tokens to Supabase
      eagleEyeService.exchangeCode(code, state)
        .then(() => {
          console.log("✅ Handshake successful. Site seeded in Supabase.");
          router.push('/setup');
        })
        .catch(err => {
          console.error("❌ Auth Error:", err);
          router.push('/setup?error=auth_failed');
        });
    }
  }, [searchParams, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-black text-white">
      <div className="text-center">
        {/* Simple CSS Spinner to avoid icon library dependency for now */}
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h2 className="text-xl font-black tracking-widest uppercase">Securing Handshake</h2>
        <p className="text-slate-500 text-sm mt-2 font-mono">PLANTING TOKENS IN SUPABASE...</p>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-black text-slate-500 uppercase text-xs tracking-widest">
        Initializing...
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
