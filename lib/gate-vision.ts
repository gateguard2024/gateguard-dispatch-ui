// lib/gate-vision.ts
//
// Shared Vision prompt builder for gate monitoring.
// Used by both:
//   app/api/cron/gate-monitor/route.ts  (production cron)
//   app/api/gate-monitor/scan/route.ts  (debug scan)
//
// Incorporates gate type (what "open" looks like) and region (where in frame)
// to dramatically improve Claude's accuracy on diverse gate configurations.

export type GateType = 'barrier_arm' | 'swing' | 'slide' | 'vertical_lift';

export interface GateConfig {
  gate_label: string;
  gate_type:  GateType;
  region:     { x: number; y: number; w: number; h: number } | null;
}

// Human-readable description of what each gate type looks like when open vs closed.
// These go directly into the Vision prompt so Claude knows what visual cues to use.
const GATE_TYPE_DESCRIPTIONS: Record<GateType, { open: string; closed: string }> = {
  barrier_arm: {
    open:   'horizontal arm/bar is raised up (pointing toward sky, roughly vertical)',
    closed: 'horizontal arm/bar is lowered across the lane (roughly horizontal, blocking passage)',
  },
  swing: {
    open:   'gate panel has swung/rotated open on its hinges, creating a clear opening in the lane',
    closed: 'gate panel is closed across the lane, blocking passage — may be a solid panel, bars, or pickets',
  },
  slide: {
    open:   'gate panel has slid or rolled sideways (left or right), exposing a clear opening in the lane',
    closed: 'gate panel spans across the lane blocking passage — look for a panel that fills the opening',
  },
  vertical_lift: {
    open:   'gate panel has lifted straight upward, creating a clear opening below it',
    closed: 'gate panel is at ground/low level, blocking the lane from below',
  },
};

// Translate a 0-1 region box into natural language spatial description
function regionToWords(r: { x: number; y: number; w: number; h: number }): string {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const h = cx < 0.38 ? 'left' : cx > 0.62 ? 'right' : 'center';
  const v = cy < 0.38 ? 'upper' : cy > 0.62 ? 'lower' : 'middle';
  const size = r.w * r.h;
  const area = size > 0.4 ? 'most of the frame' : size < 0.12 ? 'a small area' : 'a portion';
  if (h === 'center' && v === 'middle') return `the ${area} of the frame`;
  if (v === 'middle') return `the ${h} ${area} of the frame`;
  return `the ${v}-${h} ${area} of the frame`;
}

// Build the full Vision prompt for a set of gate configs.
// Each gate gets type-specific open/closed descriptions and region hints.
export function buildGateVisionPrompt(gates: GateConfig[]): string {
  const count = gates.length;

  const gateDescriptions = gates.map(g => {
    const type = g.gate_type ?? 'barrier_arm';
    const desc = GATE_TYPE_DESCRIPTIONS[type] ?? GATE_TYPE_DESCRIPTIONS.barrier_arm;
    const regionHint = g.region
      ? ` Focus on ${regionToWords(g.region)}.`
      : '';

    return `
  Gate "${g.gate_label}" — type: ${type.replace('_', ' ')}
    OPEN looks like: ${desc.open}
    CLOSED looks like: ${desc.closed}${regionHint}`;
  }).join('\n');

  const exampleGates = gates.map(g =>
    `{"label":"${g.gate_label}","status":"closed","traffic_flowing":false,"vehicle_present":false,"confidence":85}`
  ).join(',');

  return `You are a security camera AI monitoring vehicle gate(s) at a multifamily apartment community.
This camera shows ${count} gate lane${count > 1 ? 's' : ''}:
${gateDescriptions}

Carefully examine the image and classify each gate. Return ONLY valid JSON, no other text:
{"gates":[${exampleGates}]}

For each gate:
- "status": "open" | "closed" | "partial"
    open    = gate is in open position (traffic can pass)
    closed  = gate is in closed/blocking position
    partial = gate appears stuck halfway or at an unusual angle
- "traffic_flowing": true ONLY if a vehicle is actively moving through the gate RIGHT NOW
- "vehicle_present": true if any vehicle is visible in or near the gate opening (stopped or moving)
- "confidence": 0-100
    90-100 = gate clearly visible and unambiguous
    70-89  = gate visible, minor obstructions or shadows
    40-69  = gate partially obscured, inferred from context
    0-39   = gate not clearly visible in this frame

If a gate is not visible in the frame at all, return status "closed" with confidence 20.
Do not guess — if unsure, lower confidence rather than changing the status call.`;
}
