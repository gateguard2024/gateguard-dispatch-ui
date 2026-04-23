// middleware.ts
//
// Clerk authentication middleware — protects all routes except:
//   /sign-in      — Clerk sign-in page
//   /callback     — EEN OAuth return URL (must be accessible before login)
//   /api/auth/een — EEN token exchange (server-side, called from callback)
//   Static assets — _next, images, favicon, logo
//
// Role-based page access is enforced in layout.tsx (nav visibility)
// and in individual pages/API routes for write operations.

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/callback(.*)',           // EEN OAuth redirect target
  '/api/auth/een(.*)',       // EEN token exchange — called from callback page
  '/api/cron(.*)',           // Vercel cron jobs — secured by CRON_SECRET, not Clerk
  '/api/webhooks(.*)',       // EEN/Brivo webhooks — external callers, no Clerk session
  '/api/ai/triage(.*)',      // Called by cron — needs to be public
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect({
      unauthenticatedUrl: new URL('/sign-in', req.url).toString(),
    });
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    '/(api|trpc)(.*)',
  ],
};
