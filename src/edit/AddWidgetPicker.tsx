// AddWidgetPicker — modal grid of registered widget types.

import { useEffect } from 'react';

export function AddWidgetPicker({
  types,
  onPick,
  onClose,
}: {
  types: string[];
  onPick: (type: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Add widget to this page</div>
        <div className="modal-grid">
          {types.map((t) => (
            <button key={t} className="modal-tile" onClick={() => onPick(t)}>
              {t}
            </button>
          ))}
        </div>
        <div className="modal-foot">
          <span className="muted" style={{ fontSize: 11 }}>
            Auto-placed in the first free cell. Drag to move, click size to resize.
          </span>
          <button className="panel-action" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
