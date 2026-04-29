// app/api/feedback/[id]/route.ts
// Admin: update status + notes on a feature request

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// PATCH /api/feedback/:id
// Body: { status?, adminNotes? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: Record<string, string>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const updates: Record<string, string> = { updated_at: new Date().toISOString() };
  if (body.status)     updates.status      = body.status;
  if (body.adminNotes !== undefined) updates.admin_notes = body.adminNotes;

  const { data, error } = await supabase
    .from('feature_requests')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request: data });
}
