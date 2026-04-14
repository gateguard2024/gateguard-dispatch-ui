// app/api/auth/een/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { code, state } = await request.json();

    if (!code || !state) {
      return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
    }

    // 1. Decode the "Passport" back to English
    const siteName = Buffer.from(state, 'base64').toString('utf-8');
    console.log("🔓 Backend decoded site name:", siteName);

    // 2. Lookup the Site Credentials
    const { data: site, error: dbError } = await supabase
      .from('sites')
      .select('id, een_client_id, een_client_secret')
      .eq('name', siteName)
      .single();

    if (dbError || !site) {
      throw new Error(`Site not found in DB for name: ${siteName}`);
    }

    // 3. Exchange the Code for Tokens (Following EEN V3 Docs strictly)
    const REDIRECT_URI = process.env.NEXT_PUBLIC_EEN_REDIRECT_URI || "https://gateguard-dispatch-ui.vercel.app/callback";
    
    const tokenUrl = `https://auth.eagleeyenetworks.com/oauth2/token?grant_type=authorization_code&scope=vms.all&code=${code}&redirect_uri=${REDIRECT_URI}`;

    // EEN requires Basic Auth (Base64 encoded ClientID:Secret) for this step
    const authString = Buffer.from(`${site.een_client_id}:${site.een_client_secret}`).toString('base64');

    const eenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!eenResponse.ok) {
      const errText = await eenResponse.text();
      throw new Error(`Eagle Eye rejected token exchange: ${errText}`);
    }

    const tokens = await eenResponse.json();
    console.log("✅ Tokens successfully received from Eagle Eye!");

    // 4. Save Tokens to Supabase
    const { error: updateError } = await supabase
      .from('sites')
      .update({
        een_access_token: tokens.access_token,
        een_refresh_token: tokens.refresh_token
      })
      .eq('id', site.id);

    if (updateError) throw new Error("Failed to save tokens to database");

    return NextResponse.json({ success: true, siteId: site.id });

  } catch (err: any) {
    console.error("❌ Backend Auth Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
