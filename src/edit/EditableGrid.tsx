// EditableGrid — free-form layout editor for the active page's grid. Each item
// carries explicit {col, row, w, h}. During drag we render the dragged item at
// the cursor's snapped cell and run resolveCollisions so the user sees the
// final layout in real time before committing on drop.

import { useEffect, useMemo, useRef, useState } from 'react';
import { EditPanel } from './EditPanel';
import { AddWidgetPicker } from './AddWidgetPicker';
import { findFreeCell, GRID_COLS, itemFootprint, placeItems, resolveCollisions } from '../lib/grid';
import { widgetTypes } from '../widgets/registry';
import type { GridItem, Page, PlacedItem } from '../types';

// 200px row height + gap (matches --row-h / --gap defaults).
const ROW_H = 200;

interface DragState {
  srcIdx: number;
  w: number;
  h: number;
  offsetX: number;
  offsetY: number;
  ghostCol: number;
  ghostRow: number;
}

// Convert a pointer event over .grid-editing into a cell {col, row}, taking the
// drag-grab offset into account so the widget's top-left tracks the drop point.
function cellFromPointer(e: React.DragEvent, container: HTMLElement, drag: DragState): { col: number; row: number } {
  const rect = container.getBoundingClientRect();
  const cs = getComputedStyle(container);
  const gap = parseFloat(cs.columnGap || cs.gap || '16') || 16;
  const cellW = (rect.width - (GRID_COLS - 1) * gap) / GRID_COLS;
  const x = e.clientX - rect.left - drag.offsetX;
  const y = e.clientY - rect.top - drag.offsetY;
  let col = Math.floor((x + cellW / 2) / (cellW + gap)) + 1;
  let row = Math.floor((y + ROW_H / 2) / (ROW_H + gap)) + 1;
  col = Math.max(1, Math.min(GRID_COLS - drag.w + 1, col));
  row = Math.max(1, row);
  return { col, row };
}

export function EditableGrid({
  page,
  onSave,
  onCancel,
  onResetPage,
  onEditPageMeta,
}: {
  page: Page;
  onSave: (grid: GridItem[]) => void;
  onCancel: () => void;
  onResetPage: () => void;
  onEditPageMeta?: () => void;
}) {
  // Both original and draft go through placeItems so legacy layouts get
  // auto-placed and the diff doesn't see that as dirty.
  const original = useMemo(() => placeItems(page.grid || []), [page.id, page.grid]);
  const [draft, setDraft] = useState<PlacedItem[]>(original);
  useEffect(() => {
    setDraft(original);
  }, [original]);

  const [drag, setDrag] = useState<DragState | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(original);

  // Live preview while dragging: move the source to its ghost cell, then push
  // everyone else down to clear.
  const renderItems = useMemo(() => {
    if (drag == null) return draft;
    const moved = draft.map((it, i) => (i === drag.srcIdx ? { ...it, col: drag.ghostCol, row: drag.ghostRow } : it));
    return resolveCollisions(moved, drag.srcIdx);
  }, [draft, drag]);

  // + Add tile sits one row below the lowest item so it never collides.
  const addRow = renderItems.length === 0 ? 1 : Math.max(...renderItems.map((it) => it.row + it.h));

  const update = (i: number, patch: Partial<GridItem>) =>
    setDraft((d) => {
      const next = d.map((it, j) => {
        if (j !== i) return it;
        const merged = { ...it, ...patch };
        if ('w' in patch) {
          merged.col = Math.max(1, Math.min(GRID_COLS - merged.w + 1, merged.col));
        }
        return merged;
      });
      return 'w' in patch || 'h' in patch ? resolveCollisions(next, i) : next;
    });

  const remove = (i: number) => setDraft((d) => d.filter((_, j) => j !== i));

  const add = (type: string) => {
    const { w, h } = itemFootprint({ type, size: 'large' });
    const pos = findFreeCell(draft, w, h);
    setDraft((d) => [...d, { type, size: 'large', w, h, col: pos.col, row: pos.row }]);
    setShowAdd(false);
  };

  const onItemDragStart = (i: number, e: React.DragEvent) => {
    const it = draft[i];
    const wrapRect = e.currentTarget.getBoundingClientRect();
    setDrag({
      srcIdx: i,
      w: it.w,
      h: it.h,
      offsetX: e.clientX - wrapRect.left,
      offsetY: e.clientY - wrapRect.top,
      ghostCol: it.col,
      ghostRow: it.row,
    });
    try {
      e.dataTransfer.setDragImage(e.currentTarget, e.clientX - wrapRect.left, e.clientY - wrapRect.top);
    } catch {
      /* setDragImage can throw in some browsers — non-fatal */
    }
    e.dataTransfer.effectAllowed = 'move';
  };

  const onGridDragOver = (e: React.DragEvent) => {
    if (drag == null || !gridRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const { col, row } = cellFromPointer(e, gridRef.current, drag);
    if (col !== drag.ghostCol || row !== drag.ghostRow) {
      setDrag({ ...drag, ghostCol: col, ghostRow: row });
    }
  };

  const onGridDrop = (e: React.DragEvent) => {
    if (drag == null) return;
    e.preventDefault();
    setDraft(renderItems);
    setDrag(null);
  };

  const onItemDragEnd = () => setDrag(null);

  return (
    <>
      <div className="edit-toolbar">
        <span className="muted">
          Editing layout for <strong>{page.id}</strong>
        </span>
        {onEditPageMeta && (
          <button className="panel-action" onClick={onEditPageMeta} title="Edit page label / icon / title / subtitle">
            ⚙ Page settings
          </button>
        )}
        <span style={{ flex: 1 }} />
        {dirty && <span className="edit-dirty">● unsaved</span>}
        <button className="panel-action" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="panel-action"
          onClick={onResetPage}
          title="Drop your saved layout for this page; falls back to layout.yml"
        >
          Reset to default
        </button>
        <button className="panel-action edit-save" disabled={!dirty} onClick={() => onSave(draft)}>
          Save
        </button>
      </div>
      <div ref={gridRef} className="grid grid-editing" onDragOver={onGridDragOver} onDrop={onGridDrop}>
        {renderItems.map((item, i) => (
          <EditPanel
            key={i}
            item={item}
            isDragging={drag?.srcIdx === i}
            onDragStart={(e) => onItemDragStart(i, e)}
            onDragEnd={onItemDragEnd}
            onUpdate={(patch) => update(i, patch)}
            onRemove={() => remove(i)}
          />
        ))}
        <button
          className="add-tile"
          style={{ gridColumn: '1 / -1', gridRow: `${addRow} / span 1` }}
          onClick={() => setShowAdd(true)}
          title="Add a widget to this page"
        >
          <span className="add-tile-plus">+</span>
          <span>Add widget</span>
        </button>
      </div>
      {showAdd && <AddWidgetPicker types={widgetTypes().sort()} onPick={add} onClose={() => setShowAdd(false)} />}
    </>
  );
}
