// edit-mode.jsx — free-form layout editor for the active page's grid.
//
// Each item carries explicit {col, row, w, h}. During drag we render the
// dragged item at the cursor's snapped cell and run resolveCollisions
// against everyone else (push down to clear), so the user sees the final
// layout in real time before committing on drop.
//
// Save / ResetPage callbacks flow back to App.

const { useState, useMemo, useRef } = React;

// 200px row height + 16px gap (matches --row-h / --gap defaults). We read
// gap from computed style at drag time but row height is fixed in the
// design system so we treat it as a constant.
const ROW_H = 200;

// Convert a pointer event over .grid-editing into a cell {col, row}, taking
// the drag-grab offset into account so the widget's top-left tracks where
// it'd land if dropped now.
function cellFromPointer(e, container, drag) {
  const rect = container.getBoundingClientRect();
  const cs = getComputedStyle(container);
  const gap = parseFloat(cs.columnGap || cs.gap || '16') || 16;
  const cellW = (rect.width - (GRID_COLS - 1) * gap) / GRID_COLS;
  const x = e.clientX - rect.left - (drag?.offsetX ?? 0);
  const y = e.clientY - rect.top  - (drag?.offsetY ?? 0);
  // +0.5 so we snap to the nearest cell boundary, not always the floor.
  let col = Math.floor((x + cellW / 2) / (cellW + gap)) + 1;
  let row = Math.floor((y + ROW_H / 2) / (ROW_H + gap)) + 1;
  col = Math.max(1, Math.min(GRID_COLS - drag.w + 1, col));
  row = Math.max(1, row);
  return { col, row };
}

function EditableGrid({ page, onSave, onCancel, onResetPage, onEditPageMeta }) {
  // Both `original` and `draft` go through placeItems so legacy layouts
  // (no positions) get auto-placed and the diff doesn't see that as dirty.
  const original = useMemo(() => placeItems(page.grid || []), [page.id, page.grid]);
  const [draft, setDraft] = useState(original);
  React.useEffect(() => { setDraft(original); }, [original]);

  // drag = { srcIdx, w, h, offsetX, offsetY, ghostCol, ghostRow }
  // null when not dragging.
  const [drag, setDrag] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const gridRef = useRef(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(original);

  // Live preview while dragging: move the source to its ghost cell, then
  // push everyone else down to clear. Renders identical to what'll be
  // committed on drop.
  const renderItems = useMemo(() => {
    if (drag == null || drag.ghostCol == null) return draft;
    const moved = draft.map((it, i) => i === drag.srcIdx
      ? { ...it, col: drag.ghostCol, row: drag.ghostRow }
      : it);
    return resolveCollisions(moved, drag.srcIdx);
  }, [draft, drag]);

  // + Add tile sits one row below the lowest item so it never collides.
  const addRow = renderItems.length === 0
    ? 1
    : Math.max(...renderItems.map(it => it.row + it.h));

  const update = (i, patch) => setDraft(d => {
    const next = d.map((it, j) => {
      if (j !== i) return it;
      const merged = { ...it, ...patch };
      // Clamp col so the (possibly widened) item still fits within GRID_COLS.
      if ('w' in patch) {
        merged.col = Math.max(1, Math.min(GRID_COLS - merged.w + 1, merged.col));
      }
      return merged;
    });
    // w/h changes can introduce overlaps with other items — push them down.
    return ('w' in patch || 'h' in patch) ? resolveCollisions(next, i) : next;
  });

  const remove = (i) => setDraft(d => d.filter((_, j) => j !== i));

  const add = (type) => {
    const seed = { type, size: 'large' };
    const { w, h } = itemFootprint(seed);
    const pos = findFreeCell(draft, w, h);
    setDraft(d => [...d, { ...seed, w, h, col: pos.col, row: pos.row }]);
    setShowAdd(false);
  };

  const onItemDragStart = (i, e) => {
    const it = draft[i];
    const wrapRect = e.currentTarget.getBoundingClientRect();
    setDrag({
      srcIdx: i, w: it.w, h: it.h,
      offsetX: e.clientX - wrapRect.left,
      offsetY: e.clientY - wrapRect.top,
      ghostCol: it.col, ghostRow: it.row,
    });
    // Use the wrap as drag image (browser default but pinned to the grab
    // point) so the cursor doesn't drift visually.
    try { e.dataTransfer.setDragImage(e.currentTarget, e.clientX - wrapRect.left, e.clientY - wrapRect.top); } catch {}
    e.dataTransfer.effectAllowed = 'move';
  };

  const onGridDragOver = (e) => {
    if (drag == null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const { col, row } = cellFromPointer(e, gridRef.current, drag);
    if (col !== drag.ghostCol || row !== drag.ghostRow) {
      setDrag({ ...drag, ghostCol: col, ghostRow: row });
    }
  };

  const onGridDrop = (e) => {
    if (drag == null) return;
    e.preventDefault();
    setDraft(renderItems);
    setDrag(null);
  };

  const onItemDragEnd = () => setDrag(null);

  return (
    <>
      <div className="edit-toolbar">
        <span className="muted">Editing layout for <strong>{page.id}</strong></span>
        {onEditPageMeta && (
          <button className="panel-action" onClick={onEditPageMeta}
                  title="Edit page label / icon / title / subtitle">
            ⚙ Page settings
          </button>
        )}
        <span style={{flex: 1}} />
        {dirty && <span className="edit-dirty">● unsaved</span>}
        <button className="panel-action" onClick={onCancel}>Cancel</button>
        <button className="panel-action" onClick={onResetPage}
                title="Drop your saved layout for this page; falls back to layout.yml">
          Reset to default
        </button>
        <button className="panel-action edit-save" disabled={!dirty}
                onClick={() => onSave(draft)}>Save</button>
      </div>
      <div ref={gridRef} className="grid grid-editing"
           onDragOver={onGridDragOver}
           onDrop={onGridDrop}>
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
        <button className="add-tile"
                style={{ gridColumn: '1 / -1', gridRow: `${addRow} / span 1` }}
                onClick={() => setShowAdd(true)}
                title="Add a widget to this page">
          <span className="add-tile-plus">+</span>
          <span>Add widget</span>
        </button>
      </div>
      {showAdd && (
        <AddWidgetPicker
          types={Object.keys(window.WIDGETS).sort()}
          onPick={add}
          onClose={() => setShowAdd(false)}
        />
      )}
    </>
  );
}

function EditPanel({ item, isDragging, onDragStart, onDragEnd, onUpdate, onRemove }) {
  const Component = window.WIDGETS[item.type];
  const fixed = Component?.fixedSize;
  // item already carries {col, row, w, h} — placeItems / resolveCollisions
  // ran upstream so we just project them onto the grid.
  const style = {
    gridColumn: `${item.col} / span ${item.w}`,
    gridRow:    `${item.row} / span ${item.h}`,
  };
  const cls = `edit-panel-wrap ${isDragging ? 'is-dragging' : ''}`;
  return (
    <div className={cls} style={style}
         draggable
         onDragStart={onDragStart}
         onDragEnd={onDragEnd}>
      <div className="edit-panel-toolbar">
        <span className="edit-grip" title="Drag to reorder">⠿</span>
        <span className="edit-type">{item.type}</span>
        <span style={{flex: 1}} />
        {!fixed && (
          <>
            {/* Width toggle: 1 ↔ 2 cols. Larger widths (3) are reserved for
                fixedSize widgets like Portfolio. */}
            <button className="panel-action edit-size-btn"
                    onClick={() => onUpdate({ w: item.w === 1 ? 2 : 1 })}
                    title={`Switch to ${item.w === 1 ? 2 : 1} cols wide`}>
              {item.w}w
            </button>
            <button className="panel-action edit-size-btn"
                    onClick={() => onUpdate({
                      size: item.h === 1 ? 'large' : 'compact',
                      h: item.h === 1 ? 2 : 1,
                    })}
                    title={`Switch to ${item.h === 1 ? 'large' : 'compact'}`}>
              {item.h === 1 ? 'compact' : 'large'}
            </button>
          </>
        )}
        <button className="edit-x" onClick={onRemove} title="Remove from page">×</button>
      </div>
      <div className="edit-panel-preview">
        {Component ? (
          <WidgetContext.Provider value={{ type: item.type, index: 0, ...item }}>
            <Component config={item.config} />
          </WidgetContext.Provider>
        ) : (
          <div className="muted" style={{padding: 12}}>unknown widget: {item.type}</div>
        )}
      </div>
    </div>
  );
}

// PageMetaModal + IconPicker live in page-meta.jsx (loaded right before
// app.jsx in index.html — App is the only consumer).

function AddWidgetPicker({ types, onPick, onClose }) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Add widget to this page</div>
        <div className="modal-grid">
          {types.map(t => (
            <button key={t} className="modal-tile" onClick={() => onPick(t)}>{t}</button>
          ))}
        </div>
        <div className="modal-foot">
          <span className="muted" style={{fontSize: 11}}>
            Auto-placed in the first free cell. Drag to move, click size to resize.
          </span>
          <button className="panel-action" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
