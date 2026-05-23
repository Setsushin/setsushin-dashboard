// page-meta.jsx — Add/edit a page's metadata (label, icon, title, subtitle).
// Driven by /api/pages PUT (and DELETE for user-added pages).
//
// Two entry points in App:
//   - Sidebar's "+ Add page" button   → mode='add', initial=null
//   - Edit toolbar's ⚙ Page settings  → mode='edit', initial={current page}
//
// In add mode the user picks an id+label+icon+title for a brand-new page.
// In edit mode the id is fixed and we show the existing values; Delete is
// offered only for user-added pages (yaml pages can't be deleted — the
// edit-mode "Reset to default" wipes the override instead).

const { useState: usePageMetaState } = React;

// Curated subset of public/icons/ — these all render as monochrome
// strokes so they look at home in the sidebar.
const PAGE_ICONS = [
  'home', 'library', 'points', 'book', 'calendar', 'check',
  'rate', 'edit', 'link', 'account', 'settings', 'more', 'bell', 'add',
];

function IconPicker({ value, onChange }) {
  return (
    <div className="icon-picker">
      {PAGE_ICONS.map(name => {
        const path = `icons/${name}.svg`;
        const selected = value === path;
        return (
          <button key={name} type="button"
                  className={`icon-pick ${selected ? 'is-selected' : ''}`}
                  onClick={() => onChange(path)}
                  title={name}
                  aria-label={`icon: ${name}`}>
            <img src={path} alt="" />
          </button>
        );
      })}
    </div>
  );
}

// initial: { page_id?, label?, icon?, title?, subtitle?, userAdded? } | null
// existingIds: array of page IDs currently in the layout (used for conflict
// detection in add mode).
function PageMetaModal({ initial, mode, existingIds, onSave, onDelete, onClose }) {
  const isAdd = mode === 'add';
  const [pageId, setPageId]   = usePageMetaState(initial?.page_id || '');
  const [label, setLabel]     = usePageMetaState(initial?.label || '');
  const [icon, setIcon]       = usePageMetaState(initial?.icon  || 'icons/more.svg');
  const [title, setTitle]     = usePageMetaState(initial?.title || '');
  const [subtitle, setSubtitle] = usePageMetaState(initial?.subtitle || '');
  // In add mode, auto-suggest page_id from label until the user types one.
  const [idTouched, setIdTouched] = usePageMetaState(false);
  React.useEffect(() => {
    if (isAdd && !idTouched) {
      const slug = label.toLowerCase().trim()
        .replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
      setPageId(slug);
    }
  }, [label, isAdd, idTouched]);

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const idValid = /^[a-z0-9_-]+$/i.test(pageId);
  const idConflict = isAdd && existingIds.includes(pageId);
  const labelValid = label.trim().length > 0;
  const canSave = idValid && !idConflict && labelValid;

  const submit = () => {
    if (!canSave) return;
    onSave({
      page_id: pageId,
      label: label.trim(),
      icon,
      title: title.trim() || null,
      subtitle: subtitle.trim() || null,
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-page-meta" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{isAdd ? 'Add a new page' : `Page settings · ${initial?.page_id}`}</div>
        <div className="page-meta-form">
          <label className="pm-row">
            <span className="pm-label">Label</span>
            <input className="af-input" autoFocus value={label}
                   onChange={(e) => setLabel(e.target.value)}
                   placeholder="Sidebar text (e.g. Notes)" />
          </label>
          <label className="pm-row">
            <span className="pm-label">ID</span>
            <input className="af-input" value={pageId} disabled={!isAdd}
                   onChange={(e) => { setIdTouched(true); setPageId(e.target.value); }}
                   placeholder="url-slug (a-z, 0-9, -, _)" />
          </label>
          <label className="pm-row">
            <span className="pm-label">Title</span>
            <input className="af-input" value={title}
                   onChange={(e) => setTitle(e.target.value)}
                   placeholder="Page header (defaults to Label)" />
          </label>
          <label className="pm-row">
            <span className="pm-label">Subtitle</span>
            <input className="af-input" value={subtitle}
                   onChange={(e) => setSubtitle(e.target.value)}
                   placeholder="Optional one-liner under the title" />
          </label>
          <div className="pm-row">
            <span className="pm-label">Icon</span>
            <IconPicker value={icon} onChange={setIcon} />
          </div>
          {(idConflict || (!idValid && pageId.length > 0)) && (
            <div className="pm-warn">
              {idConflict ? `"${pageId}" already exists` : `Invalid ID — letters, digits, _, - only`}
            </div>
          )}
        </div>
        <div className="modal-foot">
          {onDelete && initial?.userAdded && (
            <button className="panel-action pm-delete" onClick={onDelete}
                    title="Permanently delete this page (cannot be undone)">
              Delete page
            </button>
          )}
          <span style={{flex: 1}} />
          <button className="panel-action" onClick={onClose}>Cancel</button>
          <button className="panel-action edit-save" disabled={!canSave} onClick={submit}>
            {isAdd ? 'Add page' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
