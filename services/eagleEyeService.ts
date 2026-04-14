// Add a fallback address in case the Env Var is missing
const REDIRECT_URI = process.env.NEXT_PUBLIC_EEN_REDIRECT_URI || "https://gateguard-dispatch-ui.vercel.app/callback";

export const eagleEyeService = {
  login: async (siteName: string) => {
    try {
      const response = await fetch(`/api/sites/config?name=${encodeURIComponent(siteName)}`);
      if (!response.ok) throw new Error("Site config not found");
      const config = await response.json();

      const encodedState = btoa(siteName);

      const params = new URLSearchParams({
        client_id: config.clientId, 
        response_type: 'code',
        redirect_uri: REDIRECT_URI, // Now guaranteed to have a value
        scope: 'vms.all',
        state: encodedState 
      });

      const finalUrl = `https://auth.eagleeyenetworks.com/oauth2/authorize?${params.toString()}`;
      console.log("🚀 Redirecting with URI:", REDIRECT_URI);
      window.location.href = finalUrl;
    } catch (err) {
      console.error("Login redirect failed:", err);
    }
  },
  // ... rest of the service
};

  // 2. Exchange Code
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

  // 3. Hardware Sync
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
