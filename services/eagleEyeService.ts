// services/eagleEyeService.ts

// Parse the JSON config from Vercel
const SITES = JSON.parse(process.env.NEXT_PUBLIC_SITE_CONFIG || '[]');
const REDIRECT_URI = process.env.NEXT_PUBLIC_EEN_REDIRECT_URI;

export const eagleEyeService = {
  // 1. Redirects user to the Eagle Eye Login page
  login: (siteName: string) => {
    const config = SITES.find((s: any) => s.siteName === siteName);
    if (!config) return console.error("Site not configured");

    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      redirect_uri: REDIRECT_URI!,
      scope: 'vms.all',
      'x-api-key': config.apiKey,
      state: siteName 
    });

    window.location.href = `https://auth.eagleeyenetworks.com/oauth2/authorize?${params.toString()}`;
  },

  // 2. Exchanges the one-time code for an Access Token
  exchangeCode: async (code: string, siteName: string) => {
    const config = SITES.find((s: any) => s.siteName === siteName);
    const authHeader = btoa(`${config.clientId}:${config.clientSecret}`);

    const response = await fetch('https://auth.eagleeyenetworks.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI
      })
    });

    if (!response.ok) throw new Error("Token exchange failed");
    return response.json();
  },

  // 3. THE MISSING METHOD: Fetches real camera list from the site's cluster
  getCameras: async (token: string, siteName: string) => {
    const config = SITES.find((s: any) => s.siteName === siteName);
    if (!config) throw new Error("Config missing for camera fetch");

    const response = await fetch(`${config.cluster}/api/v3.0/cameras`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-key': config.apiKey
      }
    });

    if (!response.ok) throw new Error("Failed to fetch cameras");
    return response.json();
  }
};
