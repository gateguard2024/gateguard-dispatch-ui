// app/api/brivo/config/route.ts
//
// GET  — Returns Brivo config for an account + system credential status
// POST — Saves/updates Brivo config and/or system credentials
//
// System credentials (Brivo developer app — shared across ALL accounts):
//   brivo_api_key, brivo_client_id, brivo_client_secret
//   → Stored in Supabase system_settings (or can be set as Vercel env vars)
//
// Per-account credentials (property admin login):
//   brivo_username, brivo_password  → Stored in accounts table
//   Password is write-only: API confirms it is set (has_password: true) but never returns it.
//
// Door structure (brivo_door_ids JSONB array, up to 10):
//   [{ id: "12345", name: "Main Gate", type: "gate" }, ...]
//   type: "gate" | "door" | "elevator" | "turnstile"

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getValidBrivoToken,
  brivoGet,
} from '@/lib/brivo';

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ── GET — fetch config (passwords never returned) ─────────────────────────────
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');
  const debug     = searchParams.get('debug') === '1';

  if (!accountId) {
    return NextResponse.json({ error: 'Missing accountId' }, { status: 400 });
  }

  const supabase = makeSupabase();
  const { data, error } = await supabase
    .from('accounts')
    .select('brivo_username, brivo_password, brivo_door_ids, brivo_api_key, brivo_auth_basic')
    .eq('id', accountId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: `Account not found: ${error?.message}` }, { status: 404 });
  }

  const base = {
    username:     data.brivo_username  ?? '',
    has_password: !!data.brivo_password,
    doors:        data.brivo_door_ids  ?? [],
    system: {
      has_api_key:    !!data.brivo_api_key,
      has_auth_basic: !!data.brivo_auth_basic,
    },
  };

  if (!debug) return NextResponse.json(base);

  // ?debug=1 — returns credential source diagnostics (no values, just presence)
  const { getBrivoSystemConfig } = await import('@/lib/brivo');
  const sysConfig = await getBrivoSystemConfig();
  return NextResponse.json({
    ...base,
    _debug: {
      accounts_row: {
        has_api_key:    !!data.brivo_api_key,
        has_auth_basic: !!data.brivo_auth_basic,
        has_username:   !!data.brivo_username,
        has_password:   !!data.brivo_password,
      },
      system_settings: sysConfig,
      env_vars: {
        BRIVO_API_KEY:        !!process.env.BRIVO_API_KEY,
        BRIVO_CLIENT_ID:      !!process.env.BRIVO_CLIENT_ID,
        BRIVO_CLIENT_SECRET:  !!process.env.BRIVO_CLIENT_SECRET,
        BRIVO_AUTH_BASIC:     !!process.env.BRIVO_AUTH_BASIC,
      },
    },
  });
}

// ── POST — save/update config ─────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      accountId,
      username,
      password,
      doors,
      testConnection,
      // System credentials — only sent when operator updates them in Setup UI
      systemApiKey,
      systemAuthBasic,
    } = body;

    if (!accountId) {
      return NextResponse.json({ error: 'Missing accountId' }, { status: 400 });
    }

    if (doors !== undefined && (!Array.isArray(doors) || doors.length > 10)) {
      return NextResponse.json({ error: 'doors must be an array of up to 10 items' }, { status: 400 });
    }

    const supabase = makeSupabase();

    // Build per-account update payload — only touch fields that were sent
    const update: Record<string, any> = {};
    if (username          !== undefined) update.brivo_username   = username || null;
    if (password          !== undefined && password !== '') update.brivo_password   = password;
    if (doors             !== undefined) update.brivo_door_ids   = doors;
    if (systemApiKey      !== undefined && systemApiKey)      update.brivo_api_key    = systemApiKey;
    if (systemAuthBasic   !== undefined && systemAuthBasic)   update.brivo_auth_basic = systemAuthBasic;

    // Clear cached token when any credential changes
    if (username !== undefined || password !== undefined || systemApiKey !== undefined || systemAuthBasic !== undefined) {
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

    // Optional: test connection with saved credentials
    if (testConnection) {
      try {
        const { token, apiKey } = await getValidBrivoToken(accountId);
        await brivoGet(token, apiKey, '/access-points', { pageSize: '1' });
        return NextResponse.json({ success: true, connected: true });
      } catch (testErr: any) {
        return NextResponse.json({ success: true, connected: false, connectionError: testErr.message });
      }
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('[brivo/config]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
