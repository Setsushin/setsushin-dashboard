// Unit tests for the Backdrop speed clamp.
// Run with: npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';
import { clampSpeed } from '../src/components/backdrop-utils';

const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;

test('in-range velocity is returned untouched', () => {
  const v = { x: 3, y: 0 };
  assert.equal(clampSpeed(v, 2, 5), v);
});

test('slow velocity is sped up to min, keeping its heading', () => {
  const v = clampSpeed({ x: 0.3, y: 0.4 }, 2, 5);
  assert.ok(close(Math.hypot(v.x, v.y), 2));
  assert.ok(close(v.x / v.y, 0.75));
});

test('fast velocity is slowed to max', () => {
  const v = clampSpeed({ x: -30, y: 40 }, 2, 5);
  assert.ok(close(v.x, -3) && close(v.y, 4));
});

test('a stalled body gets moving at min speed', () => {
  const v = clampSpeed({ x: 0, y: 0 }, 2, 5);
  assert.ok(close(Math.hypot(v.x, v.y), 2));
});
