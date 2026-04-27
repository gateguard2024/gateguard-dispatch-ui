// app/setup/layout.tsx
// Server-side role guard for the /setup route.
// currentUser() reads directly from Clerk — no JWT caching issues.
// Agents are redirected to /alarms. Supervisors and admins pass through.

import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function SetupLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  const role = (user.publicMetadata?.role as string) ?? 'agent';

  if (role !== 'admin' && role !== 'supervisor') {
    redirect('/alarms');
  }

  return <>{children}</>;
}
