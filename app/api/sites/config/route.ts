import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    if (!name) {
      return NextResponse.json({ error: 'Site name required' }, { status: 400 });
    }

    // Lookup the Client ID and API Key from the 'sites' table
    const { data, error } = await supabase
      .from('sites')
      .select('een_client_id, een_api_key')
      .ilike('name', name.trim()) // ilike is case-insensitive
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Site not found in database' }, { status: 404 });
    }

    return NextResponse.json({
      clientId: data.een_client_id,
      apiKey: data.een_api_key
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
