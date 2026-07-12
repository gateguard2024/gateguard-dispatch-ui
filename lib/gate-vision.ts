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

// Two supported region formats:
//   Legacy rect   — { x, y, w, h } (all 0-1 fractions)
//   New polygon   — { points: [{x,y}, ...] }  (4+ corners, 0-1 fractions)
export type RegionRect = { x: number; y: number; w: number; h: number };
export type RegionPoly = { points: Array<{ x: number; y: number }> };
export type GateRegionDef = RegionRect | RegionPoly;

export interface GateConfig {
  gate_label: string;
  gate_type:  GateType;
  region:     GateRegionDef | null;
}

/** Compute centroid, area and bounding-box centre for either region format. */
function getRegionStats(r: GateRegionDef): { cx: number; cy: number; area: number } {
  if ('points' in r && r.points.length >= 3) {
    const xs = r.points.map(p => p.x);
    const ys = r.points.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, area: (maxX - minX) * (maxY - minY) };
  }
  const { x, y, w, h } = r as RegionRect;
  return { cx: x + w / 2, cy: y + h / 2, area: w * h };
}

// Per-type visual descriptions of open vs closed states.
// Written to match what Claude Vision actually sees in a security camera frame.
const GATE_TYPE_DESCRIPTIONS: Record<GateType, { open: string; closed: string; detail: string }> = {
  barrier_arm: {
    open:   'The horizontal arm/bar is raised upward (roughly vertical, pointing toward the sky).',
    closed: 'The horizontal arm/bar is lowered across the lane (roughly horizontal, blocking vehicle passage).',
    detail: 'Barrier arms are thin horizontal bars that pivot at one end. The arm rests at 45°–90° when open and lies nearly flat (0°–15°) when closed.',
  },
  swing: {
    open:   'The gate panel has swung/rotated open on its hinges — the lane opening is CLEAR with no panel blocking it. The gate panel itself is folded back against the fence or wall to one side.',
    closed: 'The gate panel is closed across the lane — the bars, pickets, or solid panel span perpendicular to the direction of travel, blocking vehicle passage.',
    detail: `Swing gates rotate on hinges attached to a post on one side.
CLOSED: The iron bars/pickets run ACROSS the lane (left-right in the frame relative to the lane), blocking passage. The lane is visibly obstructed.
OPEN: The panel has rotated parallel to the fence. The lane opening is CLEAR — you can see pavement or sky through the opening with no bars crossing it. The panel itself may be visible folded back against the fence on one side.
PARTIAL: The panel is at an unusual angle — neither fully closed across the lane nor folded flush against the fence.`,
  },
  slide: {
    open:   'The gate panel has slid sideways (left or right), completely exposing the lane opening. The panel is stacked to one side, adjacent to the fence.',
    closed: 'The gate panel spans across the full width of the lane opening, blocking vehicle passage.',
    detail: 'Slide gates roll on a track or overhead rail. The panel fills the opening when closed and retracts to one side when open.',
  },
  vertical_lift: {
    open:   'The gate panel has lifted straight up, creating a clear vehicle opening below it. The panel is visible overhead.',
    closed: 'The gate panel is at ground or low level, blocking the lane directly.',
    detail: 'Vertical lift gates rise straight up from the ground. Open = panel clearly overhead. Closed = panel at ground level blocking the lane.',
  },
};

// ─── Region → spatial language ────────────────────────────────────────────────
// Converts a region (rect or polygon) to natural language that tells Claude where to look.
// Accounts for perspective depth: gates that are smaller and higher in the frame
// are farther from the camera (background); gates that are larger and lower are
// closer (foreground). This is critical for cameras that show multiple gates in
// a single wide-angle perspective view.
function regionToWords(r: GateRegionDef): string {
  const { cx, cy, area } = getRegionStats(r);

  // Horizontal position
  const hPos = cx < 0.35 ? 'left side' : cx > 0.65 ? 'right side' : 'center';

  // Apparent depth: inferred from region size + vertical position
  // Small + high = far background; Large + low = near foreground
  const isSmall      = area < 0.08;
  const isLarge      = area > 0.20;
  const isHigh       = cy < 0.42;
  const isLow        = cy > 0.58;

  let depth = '';
  if      (isSmall && isHigh)  depth = 'far background, ';
  else if (isLarge && isLow)   depth = 'near foreground, ';
  else if (isHigh)             depth = 'background, ';
  else if (isLow)              depth = 'foreground, ';

  return `the ${depth}${hPos} of the frame`;
}

// ─── Main prompt builder ──────────────────────────────────────────────────────
/**
 * Build the complete Vision prompt for a set of gate configs.
 * Each gate gets type-specific open/closed visual descriptions plus region hints.
 */
export function buildGateVisionPrompt(gates: GateConfig[]): string {
  const count = gates.length;

  // Group gates by type to emit type detail sections only once per type
  const typesSeen = new Set<GateType>();
  const typeDetails: string[] = [];
  for (const g of gates) {
    const t = g.gate_type ?? 'barrier_arm';
    if (!typesSeen.has(t)) {
      typesSeen.add(t);
      typeDetails.push(`[${t.replace('_', ' ')} gates]\n${GATE_TYPE_DESCRIPTIONS[t].detail}`);
    }
  }

  const gateLines = gates.map((g, i) => {
    const type = g.gate_type ?? 'barrier_arm';
    const desc = GATE_TYPE_DESCRIPTIONS[type] ?? GATE_TYPE_DESCRIPTIONS.barrier_arm;
    const where = g.region
      ? `Look at ${regionToWords(g.region)}.`
      : 'Position in frame: unspecified.';

    return `  Gate ${i + 1}: "${g.gate_label}" [${type.replace('_', ' ')}]
    Location: ${where}
    OPEN:   ${desc.open}
    CLOSED: ${desc.closed}`;
  }).join('\n\n');

  const exampleGates = gates
    .map(g =>
      `{"label":"${g.gate_label}","status":"closed","traffic_flowing":false,"vehicle_present":false,"confidence":85}`
    )
    .join(',\n    ');

  return `You are a security AI monitoring vehicle gate(s) on a multifamily apartment community camera.

== SCENE CONTEXT ==
This security camera shows ${count} gate lane${count > 1 ? 's' : ''} in a single perspective view.
${count > 1 ? `IMPORTANT — perspective scaling: gates closer to the camera appear LARGER and lower in the frame.
Gates farther from the camera appear SMALLER and higher in the frame.
Analyze each gate in its labeled region independently — do not let one gate's state influence another.` : ''}

== GATE TYPE REFERENCE ==
${typeDetails.join('\n\n')}

== GATES TO CLASSIFY ==
${gateLines}

== YOUR TASK ==
Examine the image carefully. For each gate listed above, determine its current state.

Return ONLY valid JSON — no prose, no markdown fences, no explanation:
{"gates":[
    ${exampleGates}
]}

Field definitions:
- "status":
    "open"    — gate panel is in open position; vehicle lane is clear and unobstructed
    "closed"  — gate panel is blocking the lane; vehicle cannot pass
    "partial" — gate is partway open, stuck at an angle, or visually ambiguous
- "traffic_flowing": true ONLY if a vehicle is actively in motion through the gate RIGHT NOW
- "vehicle_present": true if ANY vehicle (car, truck, motorcycle) is visible in or near the gate opening
- "confidence": integer 0–100
    90–100 = gate fully visible, state unambiguous
    70–89  = gate visible, minor shadows/obstructions
    40–69  = gate partially obscured or at the edge of frame — state inferred
    0–39   = gate not clearly visible in this frame

Rules:
- If a gate's region is not visible in the frame, return status "closed" with confidence 15.
- Do NOT round all confidences to the same number.
- Do NOT let a vehicle NEAR a gate change the gate's open/closed status — classify the gate panel position only.`;
}
