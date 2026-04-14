const REDIRECT_URI = process.env.NEXT_PUBLIC_EEN_REDIRECT_URI;

export const eagleEyeService = {
  // 1. Dynamic Login Redirect (Slimmed down to avoid 400 error)
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
        state: siteName 
      });

      // We removed x-api-key from here as EEN OAuth V3 GET requests don't expect it
      const finalUrl = `https://auth.eagleeyenetworks.com/oauth2/authorize?${params.toString()}`;
      
      console.log("🚀 Redirecting to EEN:", finalUrl);
      window.location.href = finalUrl;
    } catch (err) {
      console.error("Login redirect failed:", err);
    }
  },

  // 2. Exchange Code (Seeding the DB)
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

  // 3. Hardware Sync (Discovery)
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
