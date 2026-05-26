// Free-form grid placement. Each grid item carries explicit {col, row, w, h}.
// Legacy items (only size/fixedSize) get auto-placed on first read; once saved
// through edit mode they're stored as explicit positions in D1.
//
// Coordinate system: 1-based, 3 columns. col + w − 1 must be ≤ GRID_COLS. Row
// is unbounded. Collision resolution only pushes items DOWN (terminates).

import { fixedSizeOf } from '../widgets/registry';
import type { GridItem, PlacedItem, WidgetSize } from '../types';

export const GRID_COLS = 3;

// Derive {w, h} from persisted fields, falling back to size/fixedSize signals.
export function itemFootprint(item: GridItem): { w: number; h: number } {
  const fixed = fixedSizeOf(item.type);
  const sizeIsCompact = item.size === 'compact';
  const w = Number.isInteger(item.w)
    ? Math.min(GRID_COLS, Math.max(1, item.w as number))
    : fixed?.full
      ? GRID_COLS
      : 1;
  const h = Number.isInteger(item.h)
    ? Math.max(1, item.h as number)
    : (fixed?.rowSpan ?? (sizeIsCompact ? 1 : 2));
  return { w, h };
}

interface Box {
  col: number;
  row: number;
  w: number;
  h: number;
}

export function gridOverlaps(a: Box, b: Box): boolean {
  return !(
    a.col + a.w <= b.col ||
    b.col + b.w <= a.col ||
    a.row + a.h <= b.row ||
    b.row + b.h <= a.row
  );
}

// Scan rows top-down, left-to-right for the first cell that fits w×h.
export function findFreeCell(placed: Box[], w: number, h: number): { col: number; row: number } {
  for (let row = 1; row < 1000; row++) {
    for (let col = 1; col + w - 1 <= GRID_COLS; col++) {
      const probe = { col, row, w, h };
      if (!placed.some((p) => gridOverlaps(probe, p))) return { col, row };
    }
  }
  return { col: 1, row: 1 };
}

// Fill in {w, h, col, row, size} for every item. Items with a valid existing
// col/row keep them; the rest are flow-placed in array order.
export function placeItems(items: GridItem[] | undefined): PlacedItem[] {
  const result: PlacedItem[] = [];
  for (const it of items ?? []) {
    const { w, h } = itemFootprint(it);
    const size: WidgetSize = it.size === 'compact' ? 'compact' : 'large';
    const hasPos =
      Number.isInteger(it.col) &&
      Number.isInteger(it.row) &&
      (it.col as number) >= 1 &&
      (it.col as number) + w - 1 <= GRID_COLS &&
      (it.row as number) >= 1;
    const pos = hasPos ? { col: it.col as number, row: it.row as number } : findFreeCell(result, w, h);
    result.push({ ...it, size, w, h, col: pos.col, row: pos.row });
  }
  return result;
}

// After an item moves, push everything else DOWN until no overlaps remain.
// `anchorIdx` is the moved item — it never gets pushed.
export function resolveCollisions(items: PlacedItem[], anchorIdx: number): PlacedItem[] {
  let next = items.slice();
  let changed = true;
  let iters = 0;
  while (changed && iters++ < 50) {
    changed = false;
    for (let i = 0; i < next.length; i++) {
      if (i === anchorIdx) continue;
      const it = next[i];
      let newRow = it.row;
      for (const o of next) {
        if (o === it) continue;
        if (gridOverlaps({ ...it, row: newRow }, o)) {
          newRow = Math.max(newRow, o.row + o.h);
        }
      }
      if (newRow > it.row) {
        next = next.map((x, j) => (j === i ? { ...x, row: newRow } : x));
        changed = true;
      }
    }
  }
  return next;
}

// Normalize a layout.yml grid item: ensure size ∈ {'compact','large'} and fill
// {w, h}. col/row are filled by placeItems (which needs a global view).
export function normalizeItem(item: GridItem): GridItem {
  const size: WidgetSize = item.size === 'compact' ? 'compact' : 'large';
  const { w, h } = itemFootprint(item);
  return { ...item, size, w, h };
}
