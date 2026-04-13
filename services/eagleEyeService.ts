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

    window.location.href = `https://auth.eagleeyenetworks.com/oauth2/authorize?${params.toString()}`;
  },

  // 2. Talks to our internal Vercel Proxy (Solves CORS)
  exchangeCode: async (code: string, siteName: string) => {
    const response = await fetch('/api/auth/een', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, siteName })
    });

    if (!response.ok) throw new Error("Token exchange failed");
    return response.json();
  },

  // 3. Fetches cameras (FIXED: Forces the URL to be external)
  getCameras: async (token: string, siteName: string) => {
    const config = SITES.find((s: any) => s.siteName === siteName);
    if (!config) throw new Error("Config missing for camera fetch");

    // We force the URL to be absolute so it leaves your website
    let clusterUrl = config.cluster.trim();
    if (!clusterUrl.startsWith('http')) {
      clusterUrl = `https://${clusterUrl}`;
    }
    
    // Clean up the URL to ensure no double slashes
    const baseUrl = clusterUrl.endsWith('/') ? clusterUrl.slice(0, -1) : clusterUrl;
    const finalUrl = `${baseUrl}/api/v3.0/cameras`;

    console.log("Hitting Eagle Eye API at:", finalUrl);

    const response = await fetch(finalUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-key': config.apiKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    return response.json();
  }
};
