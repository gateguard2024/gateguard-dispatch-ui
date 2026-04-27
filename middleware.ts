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
]);

// /setup requires admin or supervisor — agents are bounced to /alarms
const isSetupRoute = createRouteMatcher(['/setup(.*)']);

export default clerkMiddleware(async (auth, req) => {
  // 1. Always allow public routes through
  if (isPublicRoute(req)) return NextResponse.next();

  // 2. Require authentication for everything else
  const session = await auth.protect({
    unauthenticatedUrl: new URL('/sign-in', req.url).toString(),
  });

  // 3. Role guard: agents cannot access /setup
  if (isSetupRoute(req)) {
    const role = (session.sessionClaims?.metadata as any)?.role ?? 'agent';
    if (role !== 'admin' && role !== 'supervisor') {
      return NextResponse.redirect(new URL('/alarms', req.url));
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    '/(api|trpc)(.*)',
  ],
};
