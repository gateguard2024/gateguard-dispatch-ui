// middleware.ts
// Clerk v6 auth middleware — required for currentUser() / auth() in Server Components
// Public routes (sign-in, callback, webhooks) bypass auth; everything else is protected.

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/callback(.*)',          // EEN OAuth callback
  '/api/auth/een(.*)',      // EEN token exchange (called server-side, no session yet)
  '/api/webhooks(.*)',      // Clerk + EEN webhooks
  '/api/cron(.*)',          // Vercel cron jobs (no user session)
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static assets
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jte|ts(?!x)|woff2?|ttf|otf|eot|ico|png|jpg|jpeg|gif|svg|webp|avif)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
