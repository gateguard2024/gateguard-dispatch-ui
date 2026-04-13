// app/api/auth/een/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { code, siteName } = await request.json();
    const SITES = JSON.parse(process.env.NEXT_PUBLIC_SITE_CONFIG || '[]');
    const REDIRECT_URI = process.env.NEXT_PUBLIC_EEN_REDIRECT_URI;
    const config = SITES.find((s: any) => s.siteName === siteName);
    
    if (!config) return NextResponse.json({ error: 'Config missing' }, { status: 400 });

    const authHeader = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

    const response = await fetch('https://auth.eagleeyenetworks.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        scope: 'vms.all' // <--- THE MISSING PIECE FROM THE DOCS
      })
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Auth server error' }, { status: 500 });
  }
}
