// app/api/een/cameras/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { token, siteName } = await request.json();
    const SITES = JSON.parse(process.env.NEXT_PUBLIC_SITE_CONFIG || '[]');
    
    const config = SITES.find((s: any) => s.siteName === siteName);
    
    if (!config) {
      return NextResponse.json({ error: 'Config not found' }, { status: 400 });
    }

    // Ensure the cluster URL is clean
    let baseUrl = config.cluster.trim();
    if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

    const response = await fetch(`${baseUrl}/api/v3.0/cameras`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-key': config.apiKey,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Server failed to fetch cameras' }, { status: 500 });
  }
}
