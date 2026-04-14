// services/eagleEyeService.ts
const REDIRECT_URI = process.env.NEXT_PUBLIC_EEN_REDIRECT_URI || "https://gateguard-dispatch-ui.vercel.app/callback";

export const eagleEyeService = {
  // 1. Redirect user to Eagle Eye Login
  login: async (siteName: string) => {
    try {
      const response = await fetch(`/api/sites/config?name=${encodeURIComponent(siteName)}`);
      if (!response.ok) throw new Error("Site config not found");
      const config = await response.json();

      // EXACT match to EEN V3 Documentation 
      const params = new URLSearchParams({
        client_id: config.clientId, 
        response_type: 'code',
        scope: 'vms.all',
        redirect_uri: REDIRECT_URI,
        state: btoa(siteName)
      });

      const finalUrl = `https://auth.eagleeyenetworks.com/oauth2/authorize?${params.toString()}`;
      
      console.log("🚀 REDIRECTING EXACT API MATCH:", finalUrl);
      window.location.href = finalUrl;
    } catch (err) {
      console.error("Login redirect failed:", err);
    }
  },

  // 2. Exchange the temporary code for permanent tokens
  exchangeCode: async (code: string, state: string) => {
    const response = await fetch('/api/auth/een', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Auth exchange failed");
    }
    return response.json();
  },

  // 3. Trigger hardware discovery once authenticated
  syncHardware: async (siteId: string) => {
    // 👇 The 404 Fix: Routing to our consolidated hardware endpoint
    const response = await fetch('/api/een/sync-hardware', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || error.message || "Hardware sync failed");
    }
    return response.json();
  }
};
