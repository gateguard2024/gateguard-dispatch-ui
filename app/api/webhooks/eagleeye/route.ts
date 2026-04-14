export async function POST(request: Request) {
  const payload = await request.json();
  const { esn, event_type, timestamp } = payload;

  // 1. Find which site this ESN belongs to
  const { data: camera } = await supabase
    .from('cameras')
    .select('id, site_id, name')
    .eq('een_esn', esn)
    .single();

  if (!camera) return NextResponse.json({ error: "Unknown Camera ESN" }, { status: 404 });

  // 2. Create the Alarm record
  const { data: alarm, error } = await supabase
    .from('alarms')
    .insert({
      site_id: camera.site_id,
      camera_id: camera.id,
      event_type: event_type || 'Motion Detected',
      status: 'pending',
      event_timestamp: timestamp, // Crucial for the "Pre-Alarm" video clip
      priority: 100
    })
    .select()
    .single();

  return NextResponse.json({ success: true, alarmId: alarm.id });
}
