// app/api/een/subscribe-events/route.ts
//
// Creates (or re-creates) a persistent EEN webhook subscription for a given account.
// Tells EEN to POST camera events to our /api/webhooks/eagleeye endpoint.
//
// Call this once per account after OAuth setup, or from the Setup page.
//
// EEN V3 Event Subscriptions API:
//   POST /api/v3.0/eventSubscriptions
//   Body: { deliveryConfig, filters }
//
// deliveryConfig (webhook.v1):
//   { type: "webhook.v1", url: "https://...", secret: "optional-hmac-secret" }
//
// filters: array — events matching ANY filter are delivered.
//   Each filter object: { type__in: [...eventTypes] }
//   (actor filter scopes to specific cameras — omit for all cameras on account)
//
// Subscription stays alive as long as we return 200 OK to incoming webhooks.
// EEN disables it after 90 days of failed delivery.
//
// Request body: { accountId: string }
// Response:     { subscriptionId: string }

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getValidEENToken } from '@/lib/een';

// Event types we want EEN to send us (all non-P4 types from webhook receiver)
// P4 device-status events are omitted — we don't alarm on those.
const SUBSCRIBED_EVENT_TYPES = [
  'een.intrusionDetection.v1',
  'een.tamperDetection.v1',
  'een.loiteringDetection.v1',
  'een.trespassDetection.v1',
  'een.sabotagDetection.v1',
  'een.accessDenied.v1',
  'een.personDetection.v1',
  'een.vehicleDetection.v1',
  'een.objectDetection.v1',
  'een.crowdDetection.v1',
  'een.crossLineDetection.v1',
  'een.motionDetection.v1',
];

export async function POST(request: Request) {
  try {
    const { accountId } = await request.json();

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { token, cluster, apiKey } = await getValidEENToken(accountId);

    if (!token || !cluster) {
      return NextResponse.json({ error: 'EEN not authenticated for this account' }, { status: 400 });
    }

    // Our Vercel webhook receiver URL
    // Include accountId as a query param so the receiver can look up the account if needed
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://gateguard-dispatch-ui.vercel.app'}/api/webhooks/eagleeye?accountId=${accountId}`;

    const headers: Record<string, string> = {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept:         'application/json',
    };
    if (apiKey) headers['x-api-key'] = apiKey;

    // ── Delete existing subscription first (if stored) ────────────────────────
    const { data: account } = await supabase
      .from('accounts')
      .select('een_webhook_subscription_id')
      .eq('id', accountId)
      .maybeSingle();

    const existingSubId = (account as any)?.een_webhook_subscription_id;

    if (existingSubId) {
      console.log(`[subscribe-events] Deleting old subscription ${existingSubId}`);
      await fetch(`https://${cluster}/api/v3.0/eventSubscriptions/${existingSubId}`, {
        method:  'DELETE',
        headers,
      });
    }

    // ── Create new webhook subscription ───────────────────────────────────────
    const body = {
      deliveryConfig: {
        type: 'webhook.v1',
        url:  webhookUrl,
        // secret: process.env.EEN_WEBHOOK_SECRET ?? undefined,
        // Uncomment and set EEN_WEBHOOK_SECRET in Vercel env vars to enable
        // HMAC signature verification on incoming webhook payloads
      },
      filters: [
        {
          // Deliver all subscribed event types for camera actors
          type__in:  SUBSCRIBED_EVENT_TYPES,
          actorType: 'camera',
        },
      ],
    };

    console.log(`[subscribe-events] Creating subscription → ${webhookUrl}`);

    const res     = await fetch(`https://${cluster}/api/v3.0/eventSubscriptions`, {
      method:  'POST',
      headers,
      body:    JSON.stringify(body),
    });

    const resText = await res.text();
    console.log(`[subscribe-events] EEN response ${res.status}: ${resText.slice(0, 300)}`);

    if (!res.ok) {
      return NextResponse.json(
        { error: `EEN subscription error ${res.status}: ${resText}` },
        { status: res.status }
      );
    }

    const data           = JSON.parse(resText);
    const subscriptionId = data.id;

    // ── Store subscription ID on account ──────────────────────────────────────
    await supabase
      .from('accounts')
      .update({ een_webhook_subscription_id: subscriptionId } as any)
      .eq('id', accountId);

    console.log(`[subscribe-events] Subscription created: ${subscriptionId}`);

    return NextResponse.json({ subscriptionId, webhookUrl });

  } catch (err: any) {
    console.error('[subscribe-events] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
