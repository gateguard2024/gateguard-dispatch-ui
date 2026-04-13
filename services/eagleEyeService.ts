// services/eagleEyeService.ts

const SITES = JSON.parse(process.env.NEXT_PUBLIC_SITE_CONFIG || '[]');
const REDIRECT_URI = process.env.NEXT_PUBLIC_EEN_REDIRECT_URI;

export const eagleEyeService = {
  // 1. Redirects to Eagle Eye
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

    window.location.href = `https://auth.eagleeyenetworks.com/authorize?${params.toString()}`;
  },

  // 2. Talks to OUR Vercel API (Solves CORS)
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
