// EditPanel — one widget tile in edit mode: drag handle, width/size toggles,
// remove button, and a live preview of the widget.

import { fixedSizeOf, getWidget, WidgetContext } from '../widgets/registry';
import type { GridItem, PlacedItem } from '../types';

export function EditPanel({
  item,
  isDragging,
  onDragStart,
  onDragEnd,
  onUpdate,
  onRemove,
}: {
  item: PlacedItem;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onUpdate: (patch: Partial<GridItem>) => void;
  onRemove: () => void;
}) {
  const Component = getWidget(item.type);
  const fixed = fixedSizeOf(item.type);
  const style = {
    gridColumn: `${item.col} / span ${item.w}`,
    gridRow: `${item.row} / span ${item.h}`,
  };
  return (
    <div
      className={`edit-panel-wrap ${isDragging ? 'is-dragging' : ''}`}
      style={style}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="edit-panel-toolbar">
        <span className="edit-grip" title="Drag to reorder">
          ⠿
        </span>
        <span className="edit-type">{item.type}</span>
        <span style={{ flex: 1 }} />
        {!fixed && (
          <>
            <button
              className="panel-action edit-size-btn"
              onClick={() => onUpdate({ w: item.w === 1 ? 2 : 1 })}
              title={`Switch to ${item.w === 1 ? 2 : 1} cols wide`}
            >
              {item.w}w
            </button>
            <button
              className="panel-action edit-size-btn"
              onClick={() => onUpdate({ size: item.h === 1 ? 'large' : 'compact', h: item.h === 1 ? 2 : 1 })}
              title={`Switch to ${item.h === 1 ? 'large' : 'compact'}`}
            >
              {item.h === 1 ? 'compact' : 'large'}
            </button>
          </>
        )}
        <button className="edit-x" onClick={onRemove} title="Remove from page">
          ×
        </button>
      </div>
      <div className="edit-panel-preview">
        {Component ? (
          <WidgetContext.Provider value={{ ...item, index: 0 }}>
            <Component config={item.config} />
          </WidgetContext.Provider>
        ) : (
          <div className="muted" style={{ padding: 12 }}>
            unknown widget: {item.type}
          </div>
        )}
      </div>
    </div>
  );
}
