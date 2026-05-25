// Color helpers shared by App (accent derivation) and the assets sunburst.

// Mix accent → cream at `t` to derive --accent-soft live so user-picked
// custom accents stay readable on warm backgrounds.
export function hexToSoft(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 'rgba(217, 119, 87, 0.22)';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const bg = [251, 247, 240];
  const mix = (a: number, c: number, t: number) => Math.round(a * t + c * (1 - t));
  return `rgb(${mix(r, bg[0], 0.28)}, ${mix(g, bg[1], 0.28)}, ${mix(b, bg[2], 0.28)})`;
}

// Lighten a hex color toward white by `t` (0..1).
export function tint(hex: string, t = 0.35): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const blend = (c: number) => Math.round(c + (255 - c) * t);
  return `#${[blend(r), blend(g), blend(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}
