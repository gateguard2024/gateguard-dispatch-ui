// app/api/een/tags/route.ts
import { NextResponse } from 'next/server';
import { getValidEENToken } from '@/lib/een';

export async function POST(request: Request) {
  try {
    const { siteId } = await request.json();

    if (!siteId) return NextResponse.json({ error: "Missing siteId" }, { status: 400 });

    // 1. Grab credentials
    const { token, cluster, apiKey } = await getValidEENToken(siteId);

    console.log(`📡 Fetching official Tag list from EEN...`);

    // 2. Fetch directly from the official /tags endpoint
    // We use pageSize=500 to grab as many as possible in one shot for the UI dropdown
    const response = await fetch(`https://${cluster}/api/v3.0/tags?pageSize=500`, {
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

    const data = await response.json();
    const tagsArray = data.results || [];

    // 3. Extract just the string names from the returned objects
    const mappedTags = tagsArray
      .map((t: any) => t.name)
      .filter(Boolean); // Remove any null/undefined just in case

    // Sort alphabetically for the dropdown
    const sortedTags = mappedTags.sort((a: string, b: string) => a.localeCompare(b));

    console.log(`✅ Scan Complete. Found ${sortedTags.length} official tags.`);

    return NextResponse.json({ 
      success: true, 
      tags: sortedTags
    });
    
  } catch (error: any) {
    console.error("❌ Tag Scanner Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
