// lib/brivo.ts
//
// Brivo API helper — password grant, per-account credentials.
//
// Auth model:
//   App-level credentials (GateGuard's one registered Brivo developer app):
//     Resolved in priority order:
//       1. Vercel env vars:  BRIVO_API_KEY, BRIVO_CLIENT_ID, BRIVO_CLIENT_SECRET
//       2. Supabase system_settings table (set via Setup → Brivo Access → System Credentials)
//
//   Per-account in Supabase accounts table:
//     brivo_username      = property admin username
//     brivo_password      = property admin password
//     brivo_access_token  = cached token
//     brivo_token_expires = expiry timestamp
//
// Token flow:
//   POST https://auth.brivo.com/oauth/token
//   Authorization: Basic {base64(clientId:clientSecret)}
//   api-key: {BRIVO_API_KEY}
//   Body: grant_type=password&username={brivo_username}&password={brivo_password}
//
// Unlock flow (admin):
//   POST https://api.brivo.com/v1/api/access-points/{id}/activate
//   (No body. activationEnabled must be true on the access point in Brivo portal.)

import { createClient } from '@supabase/supabase-js';

const BRIVO_AUTH_URL = 'https://auth.brivo.com/oauth/token';
const BRIVO_API_BASE = 'https://api.brivo.com/v1/api';

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface BrivoTokenResult {
  token:   string;
  apiKey:  string;
  doorIds: Array<{ id: string; name: string; type: string }>;
}

interface BrivoAppCreds {
  apiKey:    string;
  authBasic: string; // base64(clientId:clientSecret)
}

// ─── Resolve app-level credentials (env vars → Supabase fallback) ─────────────
async function getBrivoAppCreds(): Promise<BrivoAppCreds | null> {
  // 1. Env vars — fastest path, set in Vercel dashboard
  const envKey    = process.env.BRIVO_API_KEY;
  const envId     = process.env.BRIVO_CLIENT_ID;
  const envSecret = process.env.BRIVO_CLIENT_SECRET;

  if (envKey && envId && envSecret) {
    return { apiKey: envKey, authBasic: Buffer.from(`${envId}:${envSecret}`).toString('base64') };
  }

  // Legacy: support pre-computed BRIVO_AUTH_BASIC env var
  const envBasic = process.env.BRIVO_AUTH_BASIC;
  if (envKey && envBasic) {
    return { apiKey: envKey, authBasic: envBasic };
  }

  // 2. Supabase system_settings fallback — set via Setup → Brivo Access → System Credentials
  try {
    const supabase = makeSupabase();
    const { data } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['brivo_api_key', 'brivo_auth_basic', 'brivo_client_id', 'brivo_client_secret']);

    if (!data || data.length === 0) return null;

    const s: Record<string, string> = {};
    data.forEach(r => { s[r.key] = r.value; });

    const apiKey = s['brivo_api_key'];
    if (!apiKey) return null;

    // Prefer pre-computed brivo_auth_basic (mirrors working app pattern)
    if (s['brivo_auth_basic']) {
      return { apiKey, authBasic: s['brivo_auth_basic'] };
    }

    // Fall back to computing from client_id + client_secret
    const clientId     = s['brivo_client_id'];
    const clientSecret = s['brivo_client_secret'];
    if (!clientId || !clientSecret) return null;
    return { apiKey, authBasic: Buffer.from(`${clientId}:${clientSecret}`).toString('base64') };
  } catch {
    return null;
  }
}

// ─── Token management (per account) ──────────────────────────────────────────
export async function getValidBrivoToken(accountId: string): Promise<BrivoTokenResult> {
  const supabase = makeSupabase();

  // Load all brivo fields from accounts row in one query
  const { data: account, error } = await supabase
    .from('accounts')
    .select('brivo_username, brivo_password, brivo_access_token, brivo_token_expires, brivo_door_ids, brivo_api_key, brivo_auth_basic')
    .eq('id', accountId)
    .single();

  if (error || !account) throw new Error(`Account ${accountId} not found.`);

  if (!account.brivo_username || !account.brivo_password) {
    throw new Error('Brivo credentials not configured for this account. Add username + password in Setup → Brivo Access.');
  }

  // Resolve API key: accounts row → env var → system_settings
  const appCreds = account.brivo_api_key && account.brivo_auth_basic
    ? { apiKey: account.brivo_api_key, authBasic: account.brivo_auth_basic }
    : await getBrivoAppCreds();

  if (!appCreds) {
    throw new Error('Brivo app credentials not configured. Enter API Key and Auth Basic in Setup → Brivo Access → System Credentials.');
  }

  const { apiKey, authBasic } = appCreds;
  const doorIds: Array<{ id: string; name: string; type: string }> = account.brivo_door_ids ?? [];

  // Return cached token if still valid (60s buffer)
  const expiresAt = account.brivo_token_expires ? new Date(account.brivo_token_expires).getTime() : 0;
  if (account.brivo_access_token && expiresAt - Date.now() > 60_000) {
    return { token: account.brivo_access_token, apiKey, doorIds };
  }

  // Refresh token via Brivo password grant
  console.log(`[brivo] Refreshing token for account ${accountId}…`);
  console.log(`[brivo] DEBUG api-key present:      ${!!apiKey} (len=${apiKey?.length})`);
  console.log(`[brivo] DEBUG auth-basic present:   ${!!authBasic} (len=${authBasic?.length})`);
  console.log(`[brivo] DEBUG username present:      ${!!account.brivo_username}`);
  console.log(`[brivo] DEBUG password present:      ${!!account.brivo_password}`);
  console.log(`[brivo] DEBUG auth-basic prefix:     ${authBasic?.substring(0, 8)}…`);

  const res = await fetch(BRIVO_AUTH_URL, {
    method:  'POST',
    headers: {
      Authorization:  `Basic ${authBasic}`,
      'api-key':      apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'password',
      username:   account.brivo_username,
      password:   account.brivo_password,
    }).toString(),
  });

  console.log(`[brivo] DEBUG auth response status: ${res.status}`);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Brivo auth failed (${res.status}): ${errText}`);
  }

  const tokens    = await res.json();
  const newExpiry = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

  await supabase
    .from('accounts')
    .update({ brivo_access_token: tokens.access_token, brivo_token_expires: newExpiry })
    .eq('id', accountId);

  console.log(`[brivo] ✅ Token refreshed for account ${accountId}`);
  return { token: tokens.access_token, apiKey, doorIds };
}

// ─── System settings helpers (used by config route) ──────────────────────────
export async function getBrivoSystemConfig(): Promise<{
  has_api_key:    boolean;
  has_auth_basic: boolean;
}> {
  try {
    const { data } = await makeSupabase()
      .from('system_settings')
      .select('key')
      .in('key', ['brivo_api_key', 'brivo_auth_basic']);

    const keys = new Set((data ?? []).map((r: any) => r.key));
    return {
      has_api_key:    keys.has('brivo_api_key'),
      has_auth_basic: keys.has('brivo_auth_basic'),
    };
  } catch {
    return { has_api_key: false, has_auth_basic: false };
  }
}

export async function saveBrivoSystemConfig(fields: {
  apiKey?: string; authBasic?: string;
}): Promise<void> {
  const now  = new Date().toISOString();
  const rows = [
    fields.apiKey    && { key: 'brivo_api_key',    value: fields.apiKey,    updated_at: now },
    fields.authBasic && { key: 'brivo_auth_basic', value: fields.authBasic, updated_at: now },
  ].filter(Boolean) as { key: string; value: string; updated_at: string }[];

  if (rows.length === 0) return;
  const { error } = await makeSupabase()
    .from('system_settings')
    .upsert(rows, { onConflict: 'key' });
  if (error) throw new Error(error.message);
}

// ─── Authenticated GET ────────────────────────────────────────────────────────
export async function brivoGet(
  token: string, apiKey: string, path: string, params?: Record<string, string>
): Promise<any> {
  const url = new URL(`${BRIVO_API_BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, 'api-key': apiKey, Accept: 'application/json' },
  });

  if (!res.ok) throw new Error(`Brivo GET ${path} failed (${res.status}): ${await res.text()}`);
  return res.json();
}

// ─── Authenticated POST ───────────────────────────────────────────────────────
export async function brivoPost(
  token: string, apiKey: string, path: string, body?: Record<string, any>
): Promise<any> {
  const res = await fetch(`${BRIVO_API_BASE}${path}`, {
    method:  'POST',
    headers: {
      Authorization: `Bearer ${token}`, 'api-key': apiKey,
      'Content-Type': 'application/json', Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) throw new Error(`Brivo POST ${path} failed (${res.status}): ${await res.text()}`);
  // Brivo returns 200 with a plain-text body for some endpoints (e.g. /activate)
  // and 204 No Content for others — neither is JSON, so guard before parsing.
  if (res.status === 204) return { success: true };
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return { success: true };
  return res.json();
}

// ─── Authenticated PUT ────────────────────────────────────────────────────────
export async function brivoPut(
  token: string, apiKey: string, path: string, body?: Record<string, any>
): Promise<any> {
  const res = await fetch(`${BRIVO_API_BASE}${path}`, {
    method:  'PUT',
    headers: {
      Authorization: `Bearer ${token}`, 'api-key': apiKey,
      'Content-Type': 'application/json', Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) throw new Error(`Brivo PUT ${path} failed (${res.status}): ${await res.text()}`);
  if (res.status === 204) return { success: true };
  return res.json();
}
