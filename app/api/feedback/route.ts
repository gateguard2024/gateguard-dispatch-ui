// app/api/feedback/route.ts
// Feature request submission (POST) and listing (GET)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Lazy — SUPABASE_SERVICE_ROLE_KEY is a runtime secret, not available at build time
function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET  /api/feedback?status=pending&since=7d&limit=50
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status  = searchParams.get('status');   // pending | in_review | accepted | shipped | declined | all
  const since   = searchParams.get('since');    // 7d | 30d | all
  const limit   = parseInt(searchParams.get('limit') ?? '100');

  const supabase = makeSupabase();
  let query = supabase
    .from('feature_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (since && since !== 'all') {
    const days = parseInt(since.replace('d', ''));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    query = query.gte('created_at', cutoff.toISOString());
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data });
}

// POST /api/feedback
// Body: { title, description, category, priority, submittedBy, submittedById }
export async function POST(req: NextRequest) {
  let body: Record<string, string>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { title, description, category, priority, submittedBy, submittedById } = body;
  if (!title?.trim())        return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  if (!submittedBy?.trim())  return NextResponse.json({ error: 'submittedBy is required' }, { status: 400 });

  const supabase = makeSupabase();
  const { data, error } = await supabase
    .from('feature_requests')
    .insert({
      title:          title.trim(),
      description:    description?.trim() ?? null,
      category:       category   ?? 'general',
      priority:       priority   ?? 'normal',
      status:         'pending',
      submitted_by:   submittedBy.trim(),
      submitted_by_id: submittedById ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request: data }, { status: 201 });
}
