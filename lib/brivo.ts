// lib/brivo.ts
//
// Brivo API helper — password grant, per-account credentials.
//
// Auth model (mirrors EEN pattern):
//   Global env vars (GateGuard's one registered Brivo developer app):
//     BRIVO_AUTH_BASIC = base64(clientId:clientSecret)
//     BRIVO_API_KEY    = developer API key
//
//   Per-account in Supabase accounts table:
//     brivo_username      = property admin username
//     brivo_password      = property admin password
//     brivo_access_token  = cached token
//     brivo_token_expires = expiry timestamp
//
// Token flow:
//   POST https://auth.brivo.com/oauth/token
//   Authorization: Basic {BRIVO_AUTH_BASIC}
//   api-key: {BRIVO_API_KEY}
//   Body: grant_type=password&username={brivo_username}&password={brivo_password}

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
  token:    string;
  apiKey:   string;
  doorIds:  Array<{ id: string; name: string; type: string }>;
}

// ─── Token management (per account) ──────────────────────────────────────────
export async function getValidBrivoToken(accountId: string): Promise<BrivoTokenResult> {
  const supabase = makeSupabase();
  const apiKey   = process.env.BRIVO_API_KEY;
  const authBasic = process.env.BRIVO_AUTH_BASIC;

  if (!apiKey || !authBasic) {
    throw new Error('BRIVO_API_KEY and BRIVO_AUTH_BASIC must be set in Vercel env vars.');
  }

  // Load per-account credentials
  const { data: account, error } = await supabase
    .from('accounts')
    .select('brivo_username, brivo_password, brivo_access_token, brivo_token_expires, brivo_door_ids')
    .eq('id', accountId)
    .single();

  if (error || !account) {
    throw new Error(`Account ${accountId} not found.`);
  }

  if (!account.brivo_username || !account.brivo_password) {
    throw new Error('Brivo not configured for this account. Add credentials in Setup → Brivo.');
  }

  const doorIds: Array<{ id: string; name: string; type: string }> = account.brivo_door_ids ?? [];

  // Return cached token if still valid (60s buffer)
  const expiresAt = account.brivo_token_expires ? new Date(account.brivo_token_expires).getTime() : 0;
  if (account.brivo_access_token && expiresAt - Date.now() > 60_000) {
    return { token: account.brivo_access_token, apiKey, doorIds };
  }

  // Refresh token
  console.log(`[brivo] Refreshing token for account ${accountId}…`);

  const body = new URLSearchParams({
    grant_type: 'password',
    username:   account.brivo_username,
    password:   account.brivo_password,
  });

  const res = await fetch(BRIVO_AUTH_URL, {
    method:  'POST',
    headers: {
      Authorization:  `Basic ${authBasic}`,
      'api-key':      apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Brivo auth failed (${res.status}): ${errText}`);
  }

  const tokens = await res.json();
  const newExpiry = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

  await supabase
    .from('accounts')
    .update({
      brivo_access_token:  tokens.access_token,
      brivo_token_expires: newExpiry,
    })
    .eq('id', accountId);

  console.log(`[brivo] ✅ Token refreshed for account ${accountId}`);
  return { token: tokens.access_token, apiKey, doorIds };
}

// ─── Authenticated GET ────────────────────────────────────────────────────────
export async function brivoGet(
  token: string,
  apiKey: string,
  path: string,
  params?: Record<string, string>
): Promise<any> {
  const url = new URL(`${BRIVO_API_BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    method:  'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'api-key':     apiKey,
      Accept:        'application/json',
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Brivo GET ${path} failed (${res.status}): ${errText}`);
  }

  return res.json();
}

// ─── Authenticated PUT (unlock) ───────────────────────────────────────────────
export async function brivoPut(
  token: string,
  apiKey: string,
  path: string,
  body?: Record<string, any>
): Promise<any> {
  const res = await fetch(`${BRIVO_API_BASE}${path}`, {
    method:  'PUT',
    headers: {
      Authorization:  `Bearer ${token}`,
      'api-key':      apiKey,
      'Content-Type': 'application/json',
      Accept:         'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Brivo PUT ${path} failed (${res.status}): ${errText}`);
  }

  if (res.status === 204) return { success: true };
  return res.json();
}

// ─── Authenticated POST ───────────────────────────────────────────────────────
export async function brivoPost(
  token: string,
  apiKey: string,
  path: string,
  body?: Record<string, any>
): Promise<any> {
  const res = await fetch(`${BRIVO_API_BASE}${path}`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'api-key':      apiKey,
      'Content-Type': 'application/json',
      Accept:         'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Brivo POST ${path} failed (${res.status}): ${errText}`);
  }

  if (res.status === 204) return { success: true };
  return res.json();
}
