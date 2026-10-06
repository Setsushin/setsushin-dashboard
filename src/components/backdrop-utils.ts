// backdrop-utils.ts — pure helpers for the Backdrop.

export interface Vec2 {
  x: number;
  y: number;
}

// Keeps a body moving: speed is rescaled into [min, max], a stalled body gets
// a random heading. Returns `v` itself when it is already in range.
export function clampSpeed(v: Vec2, min: number, max: number): Vec2 {
  const s = Math.hypot(v.x, v.y);
  if (s === 0) {
    const a = Math.random() * Math.PI * 2;
    return { x: Math.cos(a) * min, y: Math.sin(a) * min };
  }
  if (s >= min && s <= max) return v;
  const k = Math.min(max, Math.max(min, s)) / s;
  return { x: v.x * k, y: v.y * k };
}
