// app/api/een/locations/route.ts
import { NextResponse } from 'next/server';
import { getValidEENToken } from '@/lib/een';

export async function POST(request: Request) {
  try {
    const { siteId } = await request.json();

    if (!siteId) {
      return NextResponse.json(
        { error: 'Missing siteId in request body' },
        { status: 400 }
      );
    }

    const { token, cluster, apiKey } = await getValidEENToken(siteId);

    if (!cluster || !token) {
      return NextResponse.json(
        { error: 'EEN not authenticated for this account. Re-run OAuth in Setup.' },
        { status: 400 }
      );
    }

    console.log(`[een/locations] Fetching from cluster: ${cluster}`);

    const headers: Record<string, string> = {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    if (apiKey) headers['x-api-key'] = apiKey;

    const response = await fetch(`https://${cluster}/api/v3.0/locations`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`EEN locations error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const locations: any[] = data.results ?? [];

    console.log(`[een/locations] Found ${locations.length} locations`);

    const mappedLocations = locations
      .map((loc: any) => ({
        id:          loc.id,
        name:        loc.name,
        timezone:    loc.timezone ?? 'UTC',
        cameraCount: loc.cameraCount ?? 0,
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));

    return NextResponse.json({ success: true, locations: mappedLocations });

  } catch (error: any) {
    console.error('[een/locations] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
