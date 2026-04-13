"use client";
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { eagleEyeService } from '@/services/eagleEyeService';

export default function CallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const code = searchParams.get('code');
    const siteName = searchParams.get('state');

    if (code && siteName) {
      eagleEyeService.exchangeCode(code, siteName)
        .then(tokens => {
          localStorage.setItem(`een_token_${siteName}`, tokens.access_token);
          // Redirect to the alarms page once authorized
          router.push('/alarms');
        })
        .catch(err => {
          console.error("Auth failed:", err);
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
