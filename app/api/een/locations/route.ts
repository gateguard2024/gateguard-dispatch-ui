// app/api/een/locations/route.ts
import { NextResponse } from 'next/server';
import { getValidEENToken } from '@/lib/een';

export async function POST(request: Request) {
  try {
    const { siteId } = await request.json();

    if (!siteId) {
      return NextResponse.json({ error: "Missing siteId in request body" }, { status: 400 });
    }

    // 1. Get the active token, cluster, and API key for this specific site
    const { token, cluster, apiKey } = await getValidEENToken(siteId);

    console.log(`📡 Fetching EEN Locations from cluster: ${cluster}`);

    // 2. Fetch the locations (Sub-Accounts) from Eagle Eye V3
    const response = await fetch(`https://${cluster}/api/v3.0/locations`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-key': apiKey ?? undefined,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("EEN Locations Error:", errText);
      throw new Error(`Failed to fetch locations: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const locations = data.results || [];

    console.log(`✅ SUCCESS! Found ${locations.length} locations/sub-accounts.`);

    // 3. Clean up the data so the frontend dropdown is easy to build
    const mappedLocations = locations.map((loc: any) => ({
      id: loc.id,
      name: loc.name,
      timezone: loc.timezone || 'UTC',
      cameraCount: loc.cameraCount || 0
    }));

    // Sort alphabetically by name for a better UX
    mappedLocations.sort((a: any, b: any) => a.name.localeCompare(b.name));

    return NextResponse.json({
      success: true,
      locations: mappedLocations
    });

  } catch (error: any) {
    console.error("❌ Fetch Locations Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
