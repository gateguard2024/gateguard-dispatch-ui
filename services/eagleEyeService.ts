// services/eagleEyeService.ts
const REDIRECT_URI = process.env.NEXT_PUBLIC_EEN_REDIRECT_URI || "https://gateguard-dispatch-ui.vercel.app/callback";

export const eagleEyeService = {
  login: async (siteName: string) => {
    try {
      // 1. Fetch the distinct keys for this site from Supabase
      const response = await fetch(`/api/sites/config?name=${encodeURIComponent(siteName)}`);
      if (!response.ok) throw new Error("Site config not found");
      const config = await response.json();

      // 2. Build the string to match Eagle Eye V3 requirements EXACTLY
      const params = new URLSearchParams({
        client_id: config.clientId,      // From Dev Portal: "Client ID"
        x_api_key: config.apiKey,        // From EEN Site: "API Key"
        response_type: 'code',
        scope: 'vms.all',
        redirect_uri: REDIRECT_URI,
        state: btoa(siteName)            // Encoded Site Name "Passport"
      });

      const finalUrl = `https://auth.eagleeyenetworks.com/oauth2/authorize?${params.toString()}`;
      
      console.log("🚀 AUTH STRING MATCHED:", finalUrl);
      window.location.href = finalUrl;
    } catch (err) {
      console.error("Login redirect failed:", err);
    }
  },

  exchangeCode: async (code: string, state: string) => {
    const response = await fetch('/api/auth/een', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state })
    });
    return response.json();
  }
};
