// app/api/brivo/config/route.ts
//
// GET  — Returns Brivo config for an account (password NEVER returned)
// POST — Saves/updates Brivo config for an account
//
// Password is write-only. Once saved, the API only confirms it is set
// (has_password: true) but never returns the actual value.
//
// Door structure (brivo_door_ids JSONB array, up to 10):
//   [{ id: "12345", name: "Main Gate", type: "gate", order: 1 }, ...]
//   type: "gate" | "door" | "elevator" | "turnstile"

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getValidBrivoToken, brivoGet } from '@/lib/brivo';

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ── GET — fetch config (no password) ──────────────────────────────────────────
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');

  if (!accountId) {
    return NextResponse.json({ error: 'Missing accountId' }, { status: 400 });
  }

  const supabase = makeSupabase();
  const { data, error } = await supabase
    .from('accounts')
    .select('brivo_username, brivo_password, brivo_door_ids')
    .eq('id', accountId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  return NextResponse.json({
    username:     data.brivo_username ?? '',
    has_password: !!data.brivo_password,   // NEVER return the actual password
    doors:        data.brivo_door_ids ?? [],
  });
}

// ── POST — save/update config ─────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { accountId, username, password, doors, testConnection } = body;

    if (!accountId) {
      return NextResponse.json({ error: 'Missing accountId' }, { status: 400 });
    }

    // Validate doors array
    if (doors !== undefined) {
      if (!Array.isArray(doors) || doors.length > 10) {
        return NextResponse.json({ error: 'doors must be an array of up to 10 items' }, { status: 400 });
      }
    }

    const supabase = makeSupabase();

    // Build update payload — only update fields that are provided
    const update: Record<string, any> = {};
    if (username !== undefined) update.brivo_username = username || null;
    if (password !== undefined && password !== '') update.brivo_password = password; // only update if new value provided
    if (doors !== undefined) update.brivo_door_ids = doors;

    // Clear cached token when credentials change so it refreshes on next use
    if (username !== undefined || password !== undefined) {
      update.brivo_access_token  = null;
      update.brivo_token_expires = null;
    }

    if (Object.keys(update).length > 0) {
      const { error: updateErr } = await supabase
        .from('accounts')
        .update(update)
        .eq('id', accountId);

      if (updateErr) throw new Error(updateErr.message);
    }

    // Optional: test connection with new credentials
    if (testConnection) {
      try {
        const { token, apiKey } = await getValidBrivoToken(accountId);
        // Try fetching one access point to confirm credentials work
        await brivoGet(token, apiKey, '/access-points', { pageSize: '1' });
        return NextResponse.json({ success: true, connected: true });
      } catch (testErr: any) {
        return NextResponse.json(
          { success: true, connected: false, connectionError: testErr.message },
        );
      }
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('[brivo/config]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
