// services/eagleEyeService.ts

login: async (siteName: string) => {
  try {
    const response = await fetch(`/api/sites/config?name=${encodeURIComponent(siteName)}`);
    if (!response.ok) throw new Error("Site config not found");
    const config = await response.json();

    // 1. We ONLY send the standard OAuth2 parameters to the /authorize endpoint
    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      scope: 'vms.all',
      redirect_uri: REDIRECT_URI!, // Ensure this matches the portal EXACTLY
      state: siteName // Our "Passport"
    });

    // 2. Eagle Eye doesn't want the x-api-key in this GET redirect.
    // We will use the api-key later in the server-side POST.
    const finalUrl = `https://auth.eagleeyenetworks.com/oauth2/authorize?${params.toString()}`;
    
    console.log("🚀 Redirecting to EEN:", finalUrl);
    window.location.href = finalUrl;
  } catch (err) {
    console.error("Login redirect failed:", err);
  }
},
