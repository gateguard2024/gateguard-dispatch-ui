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

    // Official OAuth 2.0 formatting: URLSearchParams + .toString()
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', REDIRECT_URI);
    params.append('scope', 'vms.all'); // Crucial for getting actual camera permissions

    const response = await fetch('https://auth.eagleeyenetworks.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString() // This ensures it sends as a proper form string, not an object!
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Auth server error' }, { status: 500 });
  }
}
