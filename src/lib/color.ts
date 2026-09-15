// Color helpers for the assets sunburst.

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
