// widgets/bookmarks-edit.jsx — bucket-mode infrastructure for bookmarks.jsx.
//
// Holds the things only the editable (bucket-backed) variant needs so the
// view widget stays focused on rendering:
//   - BOOKMARK_SWATCHES   — Apple-system-color preset palette
//   - useBookmarks(...)   — hook: fetch+optimistic create/remove for a bucket
//   - AddBookmarkModal    — small "+ Add" form (name + url + mark + color)
//
// Loaded right BEFORE widgets/bookmarks.jsx in index.html so the widget
// can reference these as plain globals (no module imports — same pattern
// as page-meta.jsx vs edit-mode.jsx).

const { useState: useBmEditState } = React;

// Apple system-color inspired palette — ~10 preset swatches keep the chip
// row visually consistent without a full color wheel. The first one is the
// default for new bookmarks.
const BOOKMARK_SWATCHES = [
  '#7da27c',  // sage (default)
  '#ff3b30',  // red
  '#ff9500',  // orange
  '#ffcc00',  // yellow
  '#34c759',  // green
  '#30b0c7',  // teal
  '#007aff',  // blue
  '#5856d6',  // indigo
  '#af52de',  // purple
  '#ff2d55',  // pink
  '#a2845e',  // brown
];

// Hook: returns [items, { create, remove, editable }] for a given bucket.
// Static mode (no bucket) yields the inline items array unchanged with
// editable=false so the inline UI stays out of the way.
function useBookmarks(bucket, staticItems) {
  const [items, setItems] = useBmEditState(bucket ? null : (staticItems || []));

  const reload = React.useCallback(() => {
    if (!bucket) return;
    fetch(`/api/bookmarks?bucket=${encodeURIComponent(bucket)}`)
      .then(r => r.ok ? r.json() : [])
      .then(setItems)
      .catch(() => setItems([]));
  }, [bucket]);

  React.useEffect(() => {
    if (!bucket) { setItems(staticItems || []); return; }
    reload();
  }, [bucket, reload]);

  // Optimistic mutators. POST reloads after success to pick up the
  // server-assigned id; DELETE only reloads on failure to revert.
  const create = async (form) => {
    if (!bucket) return;
    const sort_order = (items?.length ?? 0);
    setItems(prev => [...(prev || []), { ...form, id: -Date.now(), sort_order }]);
    try {
      const r = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bucket, ...form, sort_order }),
      });
      if (!r.ok) throw new Error(`POST failed: HTTP ${r.status}`);
      reload();
    } catch (err) {
      console.error(err); alert(`Add failed: ${err.message}`); reload();
    }
  };

  const remove = async (id) => {
    if (!bucket) return;
    setItems(prev => (prev || []).filter(it => it.id !== id));
    try {
      const r = await fetch(`/api/bookmarks/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(`DELETE failed: HTTP ${r.status}`);
    } catch (err) {
      console.error(err); alert(`Delete failed: ${err.message}`); reload();
    }
  };

  return [items, { create, remove, editable: !!bucket }];
}

// Light-weight modal for "+ Add bookmark". Two fields (name, url) are all
// you need; mark/color get sensible defaults derived from the name.
function AddBookmarkModal({ onSave, onClose }) {
  const [name, setName] = useBmEditState('');
  const [url, setUrl] = useBmEditState('');
  const [mark, setMark] = useBmEditState('');
  const [color, setColor] = useBmEditState(BOOKMARK_SWATCHES[0]);

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const trimmedName = name.trim();
  const trimmedUrl  = url.trim();
  const canSave = trimmedName.length > 0 && trimmedUrl.length > 0;

  const submit = () => {
    if (!canSave) return;
    onSave({
      name: trimmedName,
      url: trimmedUrl,
      mark: (mark.trim() || trimmedName[0]).toUpperCase().slice(0, 2),
      color,
    });
  };
  const onKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-page-meta" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Add bookmark</div>
        <div className="page-meta-form" onKeyDown={onKey}>
          <label className="pm-row">
            <span className="pm-label">Name</span>
            <input className="af-input" autoFocus value={name}
                   onChange={(e) => setName(e.target.value)}
                   placeholder="e.g. Hacker News" />
          </label>
          <label className="pm-row">
            <span className="pm-label">URL</span>
            <input className="af-input" value={url}
                   onChange={(e) => setUrl(e.target.value)}
                   placeholder="example.com (https:// auto-prepended)" />
          </label>
          <label className="pm-row">
            <span className="pm-label">Mark</span>
            <input className="af-input" value={mark} maxLength={2}
                   onChange={(e) => setMark(e.target.value)}
                   placeholder="1–2 chars (defaults to first letter)" />
          </label>
          <div className="pm-row">
            <span className="pm-label">Color</span>
            <div className="bookmark-swatches">
              {BOOKMARK_SWATCHES.map(c => (
                <button key={c} type="button"
                        className={`bookmark-swatch ${color === c ? 'is-selected' : ''}`}
                        style={{ background: c }}
                        onClick={() => setColor(c)}
                        aria-label={`color ${c}`} />
              ))}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <span style={{flex: 1}} />
          <button className="panel-action" onClick={onClose}>Cancel</button>
          <button className="panel-action edit-save" disabled={!canSave} onClick={submit}>Add</button>
        </div>
      </div>
    </div>
  );
}
