// app/api/een/tags/route.ts
import { NextResponse } from 'next/server';
import { getValidEENToken } from '@/lib/een';

export async function POST(request: Request) {
  try {
    const { siteId, locationId } = await request.json();

    if (!siteId) return NextResponse.json({ error: "Missing siteId" }, { status: 400 });
    if (!locationId) return NextResponse.json({ error: "Missing Sub-Account ID" }, { status: 400 });

    // 1. Grab credentials
    const { token, cluster, apiKey } = await getValidEENToken(siteId);

    console.log(`📡 Scanning Location ${locationId} for Tags...`);

    // 2. Fetch all cameras for this specific Sub-Account
    const response = await fetch(`https://${cluster}/api/v3.0/cameras?locationId__in=${locationId}`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'x-api-key': apiKey, 
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`EEN API Error: ${response.status} - ${errText}`);
    }

    const rawData = await response.json();
    const cameras = rawData.results || [];

    if (cameras.length === 0) {
        return NextResponse.json({ success: true, tags: [], message: "0 cameras found in this Location ID." });
    }

    // 3. Extract and deduplicate all tags
    const uniqueTags = new Set<string>();
    
    cameras.forEach((cam: any) => {
      if (cam.tags && Array.isArray(cam.tags)) {
        cam.tags.forEach((tag: string) => {
           // Clean up the string so we don't get duplicates based on weird spacing
           uniqueTags.add(tag.trim()); 
        });
      }
    });

    // Convert Set to a sorted array
    const sortedTags = Array.from(uniqueTags).sort((a, b) => a.localeCompare(b));

    console.log(`✅ Scan Complete. Found ${sortedTags.length} unique tags across ${cameras.length} cameras.`);

    return NextResponse.json({ 
      success: true, 
      tags: sortedTags,
      totalCamerasInLocation: cameras.length
    });
    
  } catch (error: any) {
    console.error("❌ Tag Scanner Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
