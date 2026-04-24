// app/api/brivo/doors/route.ts
//
// Returns Brivo access points for the given account.
// Uses doors stored in accounts.brivo_door_ids (configured in Setup).
// Falls back to live Brivo API if none configured.
//
// POST body: { accountId: string }
// Response:  { doors: [{ id, brivoId, name, type, status }] }

import { NextResponse }                      from 'next/server';
import { getValidBrivoToken, brivoGet }      from '@/lib/brivo';

export async function POST(request: Request) {
  try {
    const { accountId } = await request.json();
    if (!accountId) {
      return NextResponse.json({ error: 'Missing accountId' }, { status: 400 });
    }

    const { token, apiKey, doorIds } = await getValidBrivoToken(accountId);

    // Use pre-configured doors if available
    if (doorIds.length > 0) {
      const doorsWithStatus = await Promise.all(
        doorIds.map(async (door) => {
          try {
            const detail = await brivoGet(token, apiKey, `/access-points/${door.id}`);
            return {
              id:      door.id,
              brivoId: door.id,
              name:    door.name,
              type:    door.type,
              status:  detail.status ?? 'locked',
            };
          } catch {
            return { id: door.id, brivoId: door.id, name: door.name, type: door.type, status: 'unknown' };
          }
        })
      );
      return NextResponse.json({ doors: doorsWithStatus });
    }

    // Fallback — fetch all access points from Brivo
    const data = await brivoGet(token, apiKey, '/access-points', { pageSize: '50' });
    const points: any[] = data.data ?? [];

    const doors = points.map((ap: any) => ({
      id:      String(ap.id),
      brivoId: String(ap.id),
      name:    ap.name ?? 'Door',
      type:    ap.type ?? 'door',
      status:  ap.status ?? 'locked',
    }));

    return NextResponse.json({ doors });

  } catch (err: any) {
    console.error('[brivo/doors]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
