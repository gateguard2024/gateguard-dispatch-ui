// lib/een.ts
//
// Provides getValidEENToken(accountId) — called by every EEN API route.
//
// Why this file creates its own Supabase client instead of importing
// from lib/supabase.ts:
//   lib/supabase.ts uses the ANON key (safe for client-side bundles).
//   This file needs the SERVICE ROLE key to read/write sensitive token
//   columns on the accounts table. Importing the shared client here also
//   causes a module-level initialisation crash in server-side API routes
//   when the NEXT_PUBLIC_ env vars aren't available in that context.
//
// Solution: create the service-role client INSIDE the function (lazy),
// so it only runs at request time — never at module load / build time.

import { createClient } from '@supabase/supabase-js';

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface EENAccount {
  een_access_token:     string | null;
  een_cluster:          string | null;
  een_api_key:          string | null;
  een_client_id:        string | null;
  een_client_secret:    string | null;
  een_refresh_token:    string | null;
  een_token_expires_at: string | null;
  een_location_id:      string | null;
}

export async function getValidEENToken(accountId: string) {
  const supabase = makeSupabase();

  // 1. Load account credentials + current token state
  const { data: siteRaw, error } = await supabase
    .from('accounts')
    .select(
      'een_access_token, een_cluster, een_api_key, een_client_id, ' +
      'een_client_secret, een_refresh_token, een_token_expires_at, een_location_id'
    )
    .eq('id', accountId)
    .single();

  if (error || !siteRaw) {
    throw new Error(`Account not found or DB error for ID: ${accountId}`);
  }

  const site = siteRaw as unknown as EENAccount;

  // 2. Return cached token if still valid
  const isExpired = site.een_token_expires_at
    ? new Date(site.een_token_expires_at) <= new Date()
    : true;

  if (site.een_access_token && !isExpired) {
    return {
      token:      site.een_access_token,
      cluster:    site.een_cluster,
      apiKey:     site.een_api_key,
      locationId: site.een_location_id,
    };
  }

  // 3. Token missing or expired — attempt refresh
  console.log(`[een] Refreshing token for account ${accountId}…`);

  if (!site.een_client_id || !site.een_client_secret) {
    throw new Error('Missing EEN Client ID or Secret for this account.');
  }

  if (!site.een_refresh_token) {
    throw new Error('No refresh token available. Re-run OAuth for this account in Setup.');
  }

  const authHeader = Buffer.from(
    `${site.een_client_id}:${site.een_client_secret}`
  ).toString('base64');

  const params = new URLSearchParams({
    grant_type:    'refresh_token',
    refresh_token: site.een_refresh_token,
  });

  const response = await fetch('https://auth.eagleeyenetworks.com/oauth2/token', {
    method:  'POST',
    headers: {
      Authorization:  `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`EEN token refresh failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  const newExpiration = new Date(
    Date.now() + data.expires_in * 1000
  ).toISOString();

  // Persist fresh tokens
  await supabase
    .from('accounts')
    .update({
      een_access_token:     data.access_token,
      een_refresh_token:    data.refresh_token ?? site.een_refresh_token,
      een_token_expires_at: newExpiration,
    })
    .eq('id', accountId);

  console.log(`[een] Token refreshed for account ${accountId}`);

  return {
    token:      data.access_token,
    cluster:    site.een_cluster,
    apiKey:     site.een_api_key,
    locationId: site.een_location_id,
  };
}
