// app/api/een/camera-filters/route.ts
//
// Syncs a camera's monitored_events selection to the EEN event subscription as
// a per-camera filter (actors + types). Called from the Setup UI when an operator
// saves camera monitoring settings.
//
// POST body: { accountId, cameraId, monitoredEvents: string[] | null }
//   monitoredEvents: null = remove filter (camera reverts to subscription default)
//                    []   = same as null (no filter)
//                    [...] = only these event types create alarms for this camera
//
// How EEN subscription filters work:
//   Each filter: { actors: ["camera:{esn}"], types: [{ id: "een.xxx.v1" }, ...] }
//   Multiple filters on one subscription = OR logic between filters.
//   We maintain one filter per camera. Filter ID stored in cameras.een_filter_id.

import { NextResponse }   from 'next/server';
import { createClient }   from '@supabase/supabase-js';
import { getValidEENToken } from '@/lib/een';

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  try {
    const { accountId, cameraId, monitoredEvents } = await request.json();

    if (!accountId || !cameraId) {
      return NextResponse.json({ error: 'Missing accountId or cameraId' }, { status: 400 });
    }

    const supabase = makeSupabase();

    // Load camera row (need ESN + existing filter ID)
    const { data: camera, error: camErr } = await supabase
      .from('cameras')
      .select('id, een_camera_id, een_filter_id')
      .eq('id', cameraId)
      .maybeSingle();

    if (camErr || !camera) {
      return NextResponse.json({ error: 'Camera not found' }, { status: 404 });
    }

    if (!camera.een_camera_id) {
      // Not an EEN camera — just save the setting, no EEN API call needed
      await supabase.from('cameras').update({ monitored_events: monitoredEvents?.length ? monitoredEvents : null }).eq('id', cameraId);
      return NextResponse.json({ success: true, note: 'Not an EEN camera — setting saved locally only' });
    }

    // Load account's EEN subscription ID
    const { data: account } = await supabase
      .from('accounts')
      .select('een_subscription_id')
      .eq('id', accountId)
      .maybeSingle();

    const subscriptionId = account?.een_subscription_id;
    if (!subscriptionId) {
      // No subscription yet — save setting locally, EEN sync will happen when subscription is created
      await supabase.from('cameras').update({ monitored_events: monitoredEvents?.length ? monitoredEvents : null }).eq('id', cameraId);
      return NextResponse.json({ success: true, note: 'No EEN subscription found — setting saved locally' });
    }

    const { token, cluster } = await getValidEENToken(accountId);
    if (!token || !cluster) {
      return NextResponse.json({ error: 'Could not get EEN token' }, { status: 500 });
    }

    const baseUrl = `https://${cluster}/api/v3.0`;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' };

    // Delete existing filter for this camera (if any)
    if (camera.een_filter_id) {
      await fetch(`${baseUrl}/eventSubscriptions/${subscriptionId}/filters/${camera.een_filter_id}`, {
        method: 'DELETE', headers,
      });
    }

    const eventTypes: string[] = monitoredEvents?.length ? monitoredEvents : [];
    let newFilterId: string | null = null;

    // Create new filter if we have event types to filter
    if (eventTypes.length > 0) {
      const filterRes = await fetch(`${baseUrl}/eventSubscriptions/${subscriptionId}/filters`, {
        method:  'POST',
        headers,
        body:    JSON.stringify({
          actors: [`camera:${camera.een_camera_id}`],
          types:  eventTypes.map(id => ({ id })),
        }),
      });

      if (filterRes.ok) {
        const filterData = await filterRes.json();
        newFilterId = filterData.id ?? null;
      } else {
        const errText = await filterRes.text();
        console.error('[camera-filters] EEN filter create failed:', errText);
        // Still save locally even if EEN filter creation fails
      }
    }

    // Save to Supabase
    await supabase.from('cameras').update({
      monitored_events: eventTypes.length ? eventTypes : null,
      een_filter_id:    newFilterId,
    }).eq('id', cameraId);

    return NextResponse.json({ success: true, een_filter_id: newFilterId });

  } catch (err: any) {
    console.error('[camera-filters]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
