// app/api/brivo/test-write/route.ts
//
// Diagnostic endpoint — writes a test value to brivo_api_key on the accounts row
// and returns exactly what Supabase said.
//
// Usage: GET /api/brivo/test-write?accountId=YOUR_ACCOUNT_ID
// Delete this file once the save issue is resolved.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');

  if (!accountId) {
    return NextResponse.json({ error: 'Missing accountId' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Step 1: confirm we can read the row
  const { data: readData, error: readError } = await supabase
    .from('accounts')
    .select('id, brivo_api_key, brivo_auth_basic')
    .eq('id', accountId)
    .single();

  if (readError || !readData) {
    return NextResponse.json({
      step: 'read',
      ok: false,
      error: readError?.message ?? 'Row not found',
      hint: 'accountId may be wrong, or service role key is missing',
    });
  }

  // Step 2: try writing a test value
  const { error: writeError, status, statusText } = await supabase
    .from('accounts')
    .update({ brivo_api_key: 'TEST_VALUE_DELETE_ME' })
    .eq('id', accountId);

  if (writeError) {
    return NextResponse.json({
      step: 'write',
      ok: false,
      error: writeError.message,
      code: writeError.code,
      details: writeError.details,
      hint: writeError.hint,
      status,
      statusText,
    });
  }

  // Step 3: read back to confirm it actually changed
  const { data: verifyData, error: verifyError } = await supabase
    .from('accounts')
    .select('brivo_api_key, brivo_auth_basic')
    .eq('id', accountId)
    .single();

  // Clean up — remove the test value
  await supabase
    .from('accounts')
    .update({ brivo_api_key: readData.brivo_api_key ?? null })
    .eq('id', accountId);

  return NextResponse.json({
    step: 'verify',
    ok: true,
    wrote: 'TEST_VALUE_DELETE_ME',
    read_back: verifyData?.brivo_api_key,
    matched: verifyData?.brivo_api_key === 'TEST_VALUE_DELETE_ME',
    brivo_auth_basic_column_exists: 'brivo_auth_basic' in (verifyData ?? {}),
    verify_error: verifyError?.message ?? null,
  });
}
