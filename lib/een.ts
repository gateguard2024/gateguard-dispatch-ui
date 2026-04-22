import { createClient } from '@supabase/supabase-js';

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function getValidEENToken(accountId: string) {
  const supabase = makeSupabase();

  // 1. Load account credentials + current token state
  const { data: site, error } = await supabase
    .from('accounts')
    .select(
      'een_access_token, een_cluster, een_api_key, een_client_id, ' +
      'een_client_secret, een_refresh_token, een_token_expires_at, een_location_id'
    )
    .eq('id', accountId)
    .single();

  if (error || !site) {
    throw new Error(`Account not found or DB error for ID: ${accountId}`);
  }

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
