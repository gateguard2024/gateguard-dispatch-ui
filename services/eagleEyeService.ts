// services/eagleEyeService.ts
const REDIRECT_URI = process.env.NEXT_PUBLIC_EEN_REDIRECT_URI;

export const eagleEyeService = {
  // 1. Dynamic Login Redirect
  login: async (siteName: string) => {
    try {
      const response = await fetch(`/api/sites/config?name=${encodeURIComponent(siteName)}`);
      if (!response.ok) throw new Error("Site config not found");
      const config = await response.json();

      const params = new URLSearchParams({
        client_id: config.clientId,
        response_type: 'code',
        redirect_uri: REDIRECT_URI!,
        scope: 'vms.all',
        'x-api-key': config.apiKey,
        state: siteName // The "Passport"
      });

      window.location.href = `https://auth.eagleeyenetworks.com/oauth2/authorize?${params.toString()}`;
    } catch (err) {
      console.error("Login redirect failed:", err);
    }
  },

  // 2. Exchange Code (The Seeding Phase)
  exchangeCode: async (code: string, siteName: string) => {
    const response = await fetch('/api/auth/een', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state: siteName })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Auth exchange failed");
    }
    return response.json();
  },

  // 3. Hardware Sync (Discovery Phase)
  syncHardware: async (siteId: string) => {
    const response = await fetch('/api/een/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId })
    });

    if (!response.ok) throw new Error("Hardware sync failed");
    return response.json();
  }
};
