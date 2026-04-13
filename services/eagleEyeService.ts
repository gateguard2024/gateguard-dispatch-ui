// services/eagleEyeService.ts

const SITES = JSON.parse(process.env.NEXT_PUBLIC_SITE_CONFIG || '[]');
const REDIRECT_URI = process.env.NEXT_PUBLIC_EEN_REDIRECT_URI;

export const eagleEyeService = {
  // 1. Redirects to Eagle Eye (Corrected Path: /oauth2/authorize)
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

    // Added /oauth2/ to the path
    window.location.href = `https://auth.eagleeyenetworks.com/oauth2/authorize?${params.toString()}`;
  },

  // 2. Talks to our internal Vercel Proxy (Solves CORS)
  exchangeCode: async (code: string, siteName: string) => {
    const response = await fetch('/api/auth/een', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, siteName })
    });

    if (!response.ok) {
      throw new Error("Token exchange failed at API level");
    }
    return response.json();
  },

  // 3. Fetches cameras using the site's specific cluster
  getCameras: async (token: string, siteName: string) => {
    const config = SITES.find((s: any) => s.siteName === siteName);
    if (!config) throw new Error("Config missing for camera fetch");

    // Ensure the cluster URL doesn't have a trailing slash before appending path
    const baseUrl = config.cluster.endsWith('/') ? config.cluster.slice(0, -1) : config.cluster;

    const response = await fetch(`${baseUrl}/api/v3.0/cameras`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-key': config.apiKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) throw new Error("Failed to fetch cameras");
    return response.json();
  }
};
