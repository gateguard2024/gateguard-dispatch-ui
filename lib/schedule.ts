// lib/schedule.ts
//
// Schedule enforcement — determines whether a camera event timestamp falls
// within the monitoring window for a given zone or camera.
//
// Weekly schedule structure (stored in zones.weekly_schedule and cameras.schedule_override):
//   {
//     monday:    { operating: bool, shift1: { start: "HH:MM", end: "HH:MM" } | null, shift2: ..., shift3: ... },
//     tuesday:   { ... },
//     wednesday: { ... },
//     thursday:  { ... },
//     friday:    { ... },
//     saturday:  { ... },
//     sunday:    { ... },
//   }
//
// Shifts support overnight ranges (e.g. start: "22:00", end: "06:00").
// If weekly_schedule is null/empty, falls back to simple schedule_start/schedule_end fields.
// If both are null, the site is treated as always monitored (24/7).

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Parse "HH:MM" → total minutes since midnight
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

// Check if `nowMinutes` (minutes since midnight) is within a shift.
// Handles overnight: if end < start the shift crosses midnight.
function withinShift(nowMins: number, start: string, end: string): boolean {
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === e) return true;           // same time = 24h
  if (e > s)  return nowMins >= s && nowMins < e;     // normal range
  return nowMins >= s || nowMins < e;  // overnight (e.g. 22:00 – 06:00)
}

interface Shift {
  start: string;
  end:   string;
}

interface DaySchedule {
  operating?: boolean;
  shift1?:    Shift | null;
  shift2?:    Shift | null;
  shift3?:    Shift | null;
}

type WeeklySchedule = Record<string, DaySchedule>;

/**
 * Returns true if the given timestamp falls within the active monitoring window.
 *
 * Priority order:
 *   1. cameraScheduleOverride (if enabled)
 *   2. zoneWeeklySchedule (per-day shifts)
 *   3. scheduleStart / scheduleEnd (simple zone fields)
 *   4. Always monitored if nothing is configured
 */
export function isWithinMonitoringHours(opts: {
  timestampMs:            number;
  timezone:               string;        // IANA e.g. "America/New_York"
  zoneWeeklySchedule?:    WeeklySchedule | null;
  scheduleStart?:         string | null; // "HH:MM" fallback
  scheduleEnd?:           string | null; // "HH:MM" fallback
  cameraScheduleOverride?: {             // per-camera override
    enabled:         boolean;
    weekly_schedule: WeeklySchedule;
  } | null;
}): boolean {
  const { timestampMs, timezone, zoneWeeklySchedule, scheduleStart, scheduleEnd, cameraScheduleOverride } = opts;

  // Resolve which schedule to use
  let schedule: WeeklySchedule | null = null;

  if (cameraScheduleOverride?.enabled && cameraScheduleOverride.weekly_schedule) {
    schedule = cameraScheduleOverride.weekly_schedule;
  } else if (zoneWeeklySchedule && Object.keys(zoneWeeklySchedule).length > 0) {
    schedule = zoneWeeklySchedule;
  }

  // Get local time in the zone's timezone
  let localDate: Date;
  try {
    // Use Intl to get the local time components
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone:    timezone || 'UTC',
      weekday:     'long',
      hour:        'numeric',
      minute:      'numeric',
      hour12:      false,
    });
    const parts  = formatter.formatToParts(new Date(timestampMs));
    const get    = (type: string) => parts.find(p => p.type === type)?.value ?? '';
    const hour   = parseInt(get('hour'),   10);
    const minute = parseInt(get('minute'), 10);
    const nowMins = hour * 60 + minute;
    const dayName = get('weekday').toLowerCase(); // "monday", "tuesday", etc.

    // Check weekly schedule first
    if (schedule) {
      const day: DaySchedule = schedule[dayName] ?? {};
      if (day.operating === false) return false;           // day explicitly disabled
      if (day.operating === undefined && !day.shift1) return true; // no config = allow

      // Check shifts
      const shifts = [day.shift1, day.shift2, day.shift3].filter(Boolean) as Shift[];
      if (shifts.length === 0) return true;               // operating but no shifts = 24h
      return shifts.some(s => withinShift(nowMins, s.start, s.end));
    }

    // Fall back to simple start/end
    if (scheduleStart && scheduleEnd) {
      return withinShift(nowMins, scheduleStart, scheduleEnd);
    }

    return true; // No schedule configured = always monitored
  } catch {
    // Timezone parse failure — fail open (don't drop alarms)
    return true;
  }
}

/**
 * Convenience: checks a camera row against its zone's schedule.
 * Pass the full camera + zone rows from Supabase.
 */
export function isCameraWithinMonitoringHours(camera: {
  schedule_override?: any;
}, zone: {
  timezone?:        string | null;
  weekly_schedule?: any;
  schedule_start?:  string | null;
  schedule_end?:    string | null;
}, timestampMs: number): boolean {
  return isWithinMonitoringHours({
    timestampMs,
    timezone:                zone.timezone ?? 'UTC',
    zoneWeeklySchedule:      zone.weekly_schedule    ?? null,
    scheduleStart:           zone.schedule_start     ?? null,
    scheduleEnd:             zone.schedule_end       ?? null,
    cameraScheduleOverride:  camera.schedule_override ?? null,
  });
}
