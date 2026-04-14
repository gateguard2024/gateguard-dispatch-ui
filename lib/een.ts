// lib/een.ts
import { supabase } from '@/lib/supabase';

export async function getValidEENToken(siteId: string) {
  // 1. Ask Supabase for ALL necessary pieces of data (Added secrets and refresh tokens)
  const { data: site, error } = await supabase
    .from('sites')
    .select('een_access_token, een_cluster, een_api_key, een_client_id, een_client_secret, een_refresh_token, een_token_expires_at') 
    .eq('id', siteId)
    .single();

  if (error || !site) {
    throw new Error(`Database error or site not found for ID: ${siteId}`);
  }

  // 2. Check if we have a valid token that hasn't expired
  const isExpired = site.een_token_expires_at ? new Date(site.een_token_expires_at) <= new Date() : false;

  if (site.een_access_token && !isExpired) {
    // Token is good! Return it immediately to skip the refresh process.
    return {
      token: site.een_access_token,
      cluster: site.een_cluster,
      apiKey: site.een_api_key // <-- Satisfies the API key requirement!
    };
  }

  // ==========================================
  // REFRESH LOGIC (If token is missing or expired)
  // ==========================================
  console.log(`⏳ Refreshing Token for Site ID: ${siteId}...`);

  if (!site.een_client_id || !site.een_client_secret) {
    throw new Error('Missing EEN Client ID or Secret for this site.');
  }

  const authHeader = Buffer.from(`${site.een_client_id}:${site.een_client_secret}`).toString('base64');
  const params = new URLSearchParams();

  if (site.een_refresh_token) {
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', site.een_refresh_token);
  } else {
    throw new Error('No refresh token available. Manual OAuth login required for this site.');
  }

  const response = await fetch('https://auth.eagleeyenetworks.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!response.ok) {
    throw new Error('Failed to refresh Eagle Eye token.');
  }

  const data = await response.json();
  const newExpiration = new Date(Date.now() + (data.expires_in * 1000)).toISOString();

  // Save the fresh tokens back to the DB
  await supabase
    .from('sites')
    .update({
      een_access_token: data.access_token,
      een_refresh_token: data.refresh_token,
      een_token_expires_at: newExpiration
    })
    .eq('id', siteId);

  // Return the newly refreshed token AND the API key!
  return { 
    token: data.access_token, 
    cluster: site.een_cluster,
    apiKey: site.een_api_key // <-- Satisfies the API key requirement after refresh!
  };
}
