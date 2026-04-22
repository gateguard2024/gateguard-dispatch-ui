// FIXED FILE: app/api/auth/een/route.ts
// FIX: Was reading from 'sites' table — changed to 'accounts' table throughout.
// The Setup wizard saves new accounts to 'accounts', so this must match.

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { code, state } = await request.json();

    if (!code || !state) {
      return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
    }

    // 1. Decode the state param back to the account name
    const accountName = Buffer.from(state, 'base64').toString('utf-8');
    console.log("🔓 Backend decoded account name:", accountName);

    // 2. Look up credentials from 'accounts' table (NOT 'sites')
    const { data: account, error: dbError } = await supabase
      .from('accounts')
      .select('id, een_client_id, een_client_secret')
      .eq('name', accountName)
      .single();

    if (dbError || !account) {
      throw new Error(`Account not found in DB for name: "${accountName}". Check that the account was provisioned via the Setup wizard.`);
    }

    // 3. Exchange the authorization code for tokens (EEN V3 OAuth2)
    const REDIRECT_URI =
      process.env.NEXT_PUBLIC_EEN_REDIRECT_URI ||
      'https://gateguard-dispatch-ui.vercel.app/callback';

    const tokenUrl = `https://auth.eagleeyenetworks.com/oauth2/token`;
    const authString = Buffer.from(
      `${account.een_client_id}:${account.een_client_secret}`
    ).toString('base64');

    const body = new URLSearchParams({
      grant_type:   'authorization_code',
      scope:        'vms.all',
      code,
      redirect_uri: REDIRECT_URI,
    });

    const eenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization:   `Basic ${authString}`,
        'Content-Type':  'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!eenResponse.ok) {
      const errText = await eenResponse.text();
      throw new Error(`Eagle Eye rejected token exchange: ${errText}`);
    }

    const tokens = await eenResponse.json();
    console.log("✅ Tokens received from Eagle Eye. Saving to accounts table...");

    // 4. EEN returns the base cluster URL in the token response
    //    e.g. { httpsBaseUrl: { hostname: "api.c031.eagleeyenetworks.com" } }
    const cluster =
      tokens.httpsBaseUrl?.hostname ||
      tokens.endpoint ||
      null;

    // 5. Save tokens (and cluster if returned) to 'accounts' table
    const updatePayload: Record<string, string | null> = {
      een_access_token:  tokens.access_token,
      een_refresh_token: tokens.refresh_token,
    };

    if (cluster) {
      updatePayload.een_cluster = cluster;
      console.log(`📡 Cluster captured: ${cluster}`);
    }

    const { error: updateError } = await supabase
      .from('accounts')
      .update(updatePayload)
      .eq('id', account.id);

    if (updateError) throw new Error(`Failed to save tokens: ${updateError.message}`);

    // 6. Auto-register EEN webhook subscription so events flow into the alarms table.
    //    Non-fatal — OAuth succeeds even if subscription creation fails.
    if (cluster && tokens.access_token) {
      try {
        await registerEENWebhookSubscription({
          supabase,
          accountId:   account.id,
          cluster,
          token:       tokens.access_token,
          apiKey:      null, // populated later if account has one
        });
        console.log(`✅ EEN webhook subscription registered for account ${account.id}`);
      } catch (subErr: any) {
        console.warn(`⚠️ Webhook subscription failed (non-fatal): ${subErr.message}`);
      }
    }

    return NextResponse.json({ success: true, accountId: account.id });

  } catch (err: any) {
    console.error("❌ Auth Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── Webhook subscription helper ─────────────────────────────────────────────
// Registers a persistent webhook.v1 subscription with EEN so camera events
// are POSTed to /api/webhooks/eagleeye and written into the alarms table.
async function registerEENWebhookSubscription({
  supabase,
  accountId,
  cluster,
  token,
  apiKey,
}: {
  supabase:  any;
  accountId: string;
  cluster:   string;
  token:     string;
  apiKey:    string | null;
}) {
  const APP_URL =
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://gateguard-dispatch-ui.vercel.app';

  const webhookUrl = `${APP_URL}/api/webhooks/eagleeye?accountId=${accountId}`;

  const headers: Record<string, string> = {
    Authorization:  `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept:         'application/json',
  };
  if (apiKey) headers['x-api-key'] = apiKey;

  // Delete existing subscription if one was previously stored
  const { data: acct } = await supabase
    .from('accounts')
    .select('een_webhook_subscription_id')
    .eq('id', accountId)
    .maybeSingle();

  const existingSubId = acct?.een_webhook_subscription_id;
  if (existingSubId) {
    await fetch(`https://${cluster}/api/v3.0/eventSubscriptions/${existingSubId}`, {
      method: 'DELETE',
      headers,
    });
  }

  // Create new subscription for all camera event types we care about
  const body = {
    deliveryConfig: {
      type: 'webhook.v1',
      url:  webhookUrl,
    },
    filters: [
      {
        type__in: [
          'een.intrusionDetection.v1',
          'een.tamperDetection.v1',
          'een.loiteringDetection.v1',
          'een.trespassDetection.v1',
          'een.personDetection.v1',
          'een.vehicleDetection.v1',
          'een.objectDetection.v1',
          'een.crossLineDetection.v1',
          'een.motionDetection.v1',
        ],
        actorType: 'camera',
      },
    ],
  };

  const res = await fetch(`https://${cluster}/api/v3.0/eventSubscriptions`, {
    method:  'POST',
    headers,
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`EEN subscription error ${res.status}: ${errText}`);
  }

  const data = await res.json();

  // Persist subscription ID so we can replace it on re-auth
  await supabase
    .from('accounts')
    .update({ een_webhook_subscription_id: data.id })
    .eq('id', accountId);
}
