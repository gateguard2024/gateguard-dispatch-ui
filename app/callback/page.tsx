"use client";

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { eagleEyeService } from '@/services/eagleEyeService';

// 1. We move the logic into a separate "Content" component
function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const code = searchParams.get('code');
    const siteName = searchParams.get('state');

    if (code && siteName) {
      eagleEyeService.exchangeCode(code, siteName)
        .then(tokens => {
          // Store token labeled by site name
          localStorage.setItem(`een_token_${siteName}`, tokens.access_token);
          console.log(`Successfully authorized: ${siteName}`);
          
          // Redirect to the alarms page
          router.push('/alarms');
        })
        .catch(err => {
          console.error("Auth Error:", err);
          router.push('/setup?error=auth_failed');
        });
    }
  }, [searchParams, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-black text-white">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h2 className="text-xl font-black tracking-widest uppercase">Authorizing Site...</h2>
        <p className="text-slate-500 text-sm mt-2">Connecting to Pegasus Properties Portfolio</p>
      </div>
    </div>
  );
}

// 2. The main page component wraps the content in Suspense
export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <p className="text-slate-500 animate-pulse">Initializing Handshake...</p>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
