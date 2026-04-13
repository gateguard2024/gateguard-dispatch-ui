// services/eagleEyeService.ts

const SITES = JSON.parse(process.env.NEXT_PUBLIC_SITE_CONFIG || '[]');
const REDIRECT_URI = process.env.NEXT_PUBLIC_EEN_REDIRECT_URI;

export const eagleEyeService = {
  // 1. Start the Login (Direct to EEN)
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

  // 2. Exchange Code (Through Vercel Proxy)
  exchangeCode: async (code: string, siteName: string) => {
    const response = await fetch('/api/auth/een', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, siteName })
    });

    if (!response.ok) throw new Error("Token exchange failed");
    return response.json();
  },

  // 3. Fetch Cameras (THROUGH VERCEL PROXY - SOLVES CORS)
  getCameras: async (token: string, siteName: string) => {
    console.log(`Requesting cameras for ${siteName} via internal proxy...`);

    const response = await fetch('/api/een/cameras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, siteName }) // Send the token to our server
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Proxy Fetch Failed: ${response.status}`);
    }
    
    return response.json();
  }
};
