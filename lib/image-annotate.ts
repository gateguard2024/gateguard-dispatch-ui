// lib/image-annotate.ts
//
// Burns gate region labels directly into a JPEG frame before sending to Claude Vision.
//
// When Claude sees "EXIT GATE", "GUEST GATE", "RESIDENT GATE" as visible text
// inside colored bounding boxes in the image itself, it never has to infer which
// gate is which from spatial descriptions — it simply reads the label.
//
// This is the digital equivalent of painting "G1 EXIT / G2 GUEST / G3 RESIDENT"
// on the pavement in each lane so the camera can always see the identifiers.
//
// Uses sharp + SVG compositing — no extra packages needed beyond sharp.
// Sharp is natively supported on Vercel and used by Next.js image optimization.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require('sharp');

export interface AnnotationGate {
  label:     string;
  gate_type: string;
  /** Accepts both legacy rect {x,y,w,h} and new polygon {points:[{x,y},...]} formats. */
  region:    { x: number; y: number; w: number; h: number }
           | { points: Array<{ x: number; y: number }> }
           | null;
  color:     string; // hex, e.g. "#818cf8"
}

/** Normalise any region format to an array of pixel-space points. Returns null if no region. */
function regionToPixelPoints(
  region: AnnotationGate['region'],
  width:  number,
  height: number,
): Array<{ x: number; y: number }> | null {
  if (!region) return null;
  if ('points' in region && region.points.length >= 3) {
    return region.points.map(p => ({ x: Math.round(p.x * width), y: Math.round(p.y * height) }));
  }
  if ('x' in region) {
    const { x, y, w, h } = region as { x:number; y:number; w:number; h:number };
    return [
      { x: Math.round(x       * width), y: Math.round(y       * height) },
      { x: Math.round((x + w) * width), y: Math.round(y       * height) },
      { x: Math.round((x + w) * width), y: Math.round((y + h) * height) },
      { x: Math.round(x       * width), y: Math.round((y + h) * height) },
    ];
  }
  return null;
}

// Colors for up to 6 gates
export const GATE_COLORS = ['#818cf8', '#34d399', '#fb923c', '#f472b6', '#60a5fa', '#a78bfa'];

/**
 * Composite colored bounding boxes and text labels onto a JPEG buffer.
 * Gates without a configured region are skipped (no region = no annotation).
 *
 * @returns Annotated JPEG buffer, or original buffer if annotation fails.
 */
export async function annotateGateRegions(
  jpegBuffer: Buffer,
  gates:      AnnotationGate[],
): Promise<Buffer> {
  if (!gates.some(g => g.region)) {
    return jpegBuffer; // nothing to draw
  }

  try {
    // Get actual pixel dimensions so we can convert 0-1 fractions to pixels
    const meta   = await sharp(jpegBuffer).metadata();
    const width  = meta.width  ?? 1280;
    const height = meta.height ?? 720;

    // Build SVG overlay — each gate gets a colored border + label chip
    const svgParts: string[] = [];

    for (const gate of gates) {
      const pts = regionToPixelPoints(gate.region, width, height);
      if (!pts) continue;

      const c        = gate.color;
      const gateNum  = gates.indexOf(gate) + 1;
      const polyPts  = pts.map(p => `${p.x},${p.y}`).join(' ');

      // Bounding box from polygon points (for chip placement)
      const pxVals = pts.map(p => p.x);
      const pyVals = pts.map(p => p.y);
      const pxMin  = Math.min(...pxVals);
      const pyMin  = Math.min(...pyVals);
      const pxMax  = Math.max(...pxVals);
      const pyMax  = Math.max(...pyVals);
      const pw     = pxMax - pxMin;
      const ph     = pyMax - pyMin;

      // Chip height / font size — scale with region height but clamp
      const chipH    = Math.max(18, Math.min(28, Math.round(ph * 0.14)));
      const fontSize  = Math.max(11, Math.min(20, Math.round(chipH * 0.68)));
      const chipY     = Math.max(0, pyMin - chipH); // chip sits above the bounding box
      const chipLabel = `${gateNum}: ${gate.label.toUpperCase()}`;

      svgParts.push(`
        <!-- Gate ${gateNum}: ${gate.label} -->
        <polygon points="${polyPts}"
                 fill="none" stroke="${c}" stroke-width="3" opacity="0.9"/>

        <!-- Label chip background -->
        <rect x="${pxMin}" y="${chipY}" width="${pw}" height="${chipH}"
              fill="${c}" opacity="0.85" rx="2"/>

        <!-- Label text -->
        <text x="${pxMin + 6}" y="${chipY + chipH - 5}"
              fill="white"
              font-size="${fontSize}"
              font-family="Arial, Helvetica, sans-serif"
              font-weight="bold"
              letter-spacing="0.5">
          ${chipLabel}
        </text>

        <!-- Corner indicator: gate type abbreviation -->
        <rect x="${pxMax - 38}" y="${pyMin + 3}" width="35" height="16"
              fill="black" opacity="0.55" rx="2"/>
        <text x="${pxMax - 20}" y="${pyMin + 14}"
              fill="${c}"
              font-size="10"
              font-family="Arial, Helvetica, sans-serif"
              font-weight="bold"
              text-anchor="middle">
          ${gate.gate_type.replace('_', ' ').toUpperCase().slice(0, 6)}
        </text>
      `);
    }

    const svg = `<svg
      width="${width}" height="${height}"
      xmlns="http://www.w3.org/2000/svg"
      xmlns:xlink="http://www.w3.org/1999/xlink">
      ${svgParts.join('\n')}
    </svg>`;

    const annotated = await sharp(jpegBuffer)
      .composite([{
        input:   Buffer.from(svg),
        top:     0,
        left:    0,
        blend:   'over',
      }])
      .jpeg({ quality: 88 })
      .toBuffer();

    console.log(`[image-annotate] Annotated ${gates.filter(g => g.region).length} gate(s) onto ${width}×${height} JPEG (${annotated.length}B)`);
    return annotated;

  } catch (err: any) {
    console.warn('[image-annotate] Annotation failed (returning original):', err.message);
    return jpegBuffer; // always fall back to unannotated image
  }
}
