import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');

  const { data, error } = await supabase
    .from('sites')
    .select('een_client_id, een_api_key')
    .eq('name', name)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    clientId: data.een_client_id,
    apiKey: data.een_api_key
  });
}
