// middleware.ts
//
// Clerk authentication + role-based access middleware
//
// Public routes (no login required):
//   /sign-in      — Clerk sign-in page
//   /callback     — EEN OAuth return URL
//   /api/auth/een — EEN token exchange
//   /api/cron     — Vercel cron jobs (secured by CRON_SECRET)
//   /api/webhooks — EEN/Brivo webhooks (external callers)
//   /api/ai/triage — Called by cron
//   /api/brivo    — Brivo API routes
//   /api/comms/voice-connect  — Twilio TwiML App webhook (no Clerk session)
//   /api/comms/voice-fallback — Twilio post-dial callback (no Clerk session)
//
// Role-based route access:
//   agent      → /dashboard, /alarms, /cameras, /reports  (no Setup)
//   supervisor → all agent routes + /setup (view only, enforced in setup page)
//   admin      → all routes including /setup (full write)

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/callback(.*)',
  '/api/auth/een(.*)',
  '/api/cron(.*)',
  '/api/webhooks(.*)',
  '/api/ai/triage(.*)',
  '/api/brivo(.*)',
  // Twilio's servers call these with no Clerk session — must be public
  '/api/comms/voice-connect(.*)',
  '/api/comms/voice-fallback(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  // Allow public routes through without auth
  if (isPublicRoute(req)) return NextResponse.next();

  // Require authentication for everything else — unauthenticated users go to sign-in
  await auth.protect({
    unauthenticatedUrl: new URL('/sign-in', req.url).toString(),
  });

  // Role-based access for /setup is enforced inside the setup page itself
  // using currentUser() — see the redirect at the top of app/setup/page.tsx
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    '/(api|trpc)(.*)',
  ],
};
