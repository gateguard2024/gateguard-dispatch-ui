// lib/een.ts
import { supabase } from '@/lib/supabase';

export async function getValidEENToken(siteId: string) {
  // 1. Ask Supabase for all THREE pieces of data
  const { data: site, error } = await supabase
    .from('sites')
    .select('een_access_token, een_cluster, een_api_key') // MUST include een_api_key
    .eq('id', siteId)
    .single();

  if (error || !site) {
    throw new Error(`Database error or site not found for ID: ${siteId}`);
  }

  // (If you have token refresh logic here, leave it as is!)

  // 2. Return all three variables so TypeScript is happy
  return {
    token: site.een_access_token,
    cluster: site.een_cluster,
    apiKey: site.een_api_key // <-- This line makes the build error disappear
  };
}

  console.log(`Refreshing/Generating Token for Site ID: ${siteId}...`);

  // 3. We need secrets to generate a new token
  if (!site.een_client_id || !site.een_client_secret) {
    throw new Error('Missing EEN Client ID or Secret for this site.');
  }

  const authHeader = Buffer.from(`${site.een_client_id}:${site.een_client_secret}`).toString('base64');
  const params = new URLSearchParams();

  // If we have a refresh token, use it. Otherwise, we require manual OAuth login.
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

  // 4. Save the fresh tokens back to the DB
  await supabase
    .from('sites')
    .update({
      een_access_token: data.access_token,
      een_refresh_token: data.refresh_token,
      een_token_expires_at: newExpiration
    })
    .eq('id', siteId);

  return { token: data.access_token, cluster: site.een_cluster };
}
