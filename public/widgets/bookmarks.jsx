// widgets/bookmarks.jsx — view layer for the bookmarks widget.
//
// Two data modes (mutually exclusive):
//   1. Static — config.items: [...]   (legacy, edited via layout.yml)
//   2. D1-backed — config.bucket: 'home'  (editable in-UI, no yaml round-trip)
//
// In bucket mode the widget renders a + Add button at the end of the strip
// and a hover-x on each chip for deletion. layout.yml still owns where the
// widget lives (header strip vs. grid panel) and which bucket it points at.
//
// The bucket-mode plumbing (useBookmarks hook, AddBookmarkModal, swatches)
// lives in bookmarks-edit.jsx — this file is just rendering.

const { useState: useBmState } = React;

// Normalize a URL: prepend https:// when no scheme is present so href works
// regardless of how the user typed it.
function bookmarkHref(url) {
  if (!url) return '#';
  return url.startsWith('http') ? url : `https://${url}`;
}

function BookmarksWidget({ config }) {
  const size = useWidgetSize();
  const bucket = config?.bucket;
  const [items, { create, remove, editable }] = useBookmarks(bucket, config?.items);
  const [adding, setAdding] = useBmState(false);
  const isLoading = bucket && items === null;
  const list = items ?? [];

  const onAddClick = (e) => { e.preventDefault(); setAdding(true); };
  const onDelete = (e, b) => {
    e.preventDefault(); e.stopPropagation();
    if (window.confirm(`Delete "${b.name}"?`)) remove(b.id);
  };

  // Header-strip mode: a horizontal row of chips, no panel chrome.
  // Used when bookmarks lives in page.header[] (see core.jsx HeaderStrip).
  if (config?.layout === 'row') {
    return (
      <>
        <div className="bookmarks-row">
          {list.map((b) => (
            <a key={b.id ?? b.name} className="bookmark-row-chip"
               href={bookmarkHref(b.url)}
               target="_blank" rel="noopener noreferrer"
               title={b.url}>
              <span className="bookmark-favicon" style={{ background: b.color || 'var(--accent)' }}>
                {b.mark || (b.name && b.name[0].toUpperCase()) || '•'}
              </span>
              <span className="bookmark-row-name">{b.name}</span>
              {editable && (
                <button className="bookmark-row-del" onClick={(e) => onDelete(e, b)}
                        title="Delete bookmark"><XIcon size={10} /></button>
              )}
            </a>
          ))}
          {editable && (
            <button className="bookmark-row-add" onClick={onAddClick}
                    title="Add bookmark" aria-label="Add bookmark">
              <PlusIcon />
            </button>
          )}
          {isLoading && <span className="muted" style={{fontSize: 11, padding: '0 8px'}}>…</span>}
        </div>
        {adding && <AddBookmarkModal
          onSave={(form) => { create(form); setAdding(false); }}
          onClose={() => setAdding(false)} />}
      </>
    );
  }

  if (size === 'compact') {
    return (
      <Panel title="Bookmarks" action={<span className="muted" style={{fontSize: 11}}>{list.length} saved</span>}>
        <div className="bookmark-strip">
          {list.map((b) => (
            <a key={b.id ?? b.name} className="bookmark-chip"
               href={bookmarkHref(b.url)}
               target="_blank" rel="noopener noreferrer"
               title={b.name}>
              <div className="bookmark-favicon" style={{ background: b.color || 'var(--accent)' }}>
                {b.mark || (b.name && b.name[0].toUpperCase()) || '•'}
              </div>
              {editable && (
                <button className="bookmark-row-del" onClick={(e) => onDelete(e, b)}
                        title="Delete bookmark"><XIcon size={10} /></button>
              )}
            </a>
          ))}
          {editable && (
            <button className="bookmark-row-add bookmark-add-square" onClick={onAddClick}
                    title="Add bookmark" aria-label="Add bookmark">
              <PlusIcon />
            </button>
          )}
          {list.length === 0 && !editable && <div className="muted" style={{padding: 12}}>No bookmarks.</div>}
        </div>
        {adding && <AddBookmarkModal
          onSave={(form) => { create(form); setAdding(false); }}
          onClose={() => setAdding(false)} />}
      </Panel>
    );
  }

  return (
    <Panel title="Bookmarks">
      <div>
        {list.map((b) => (
          <a key={b.id ?? b.name} className="bookmark"
             href={bookmarkHref(b.url)}
             target="_blank" rel="noopener noreferrer">
            <div className="bookmark-favicon" style={{ background: b.color || 'var(--accent)' }}>
              {b.mark || (b.name && b.name[0].toUpperCase()) || '•'}
            </div>
            <div className="bookmark-body">
              <div className="bookmark-name">{b.name}</div>
              <div className="bookmark-url">{b.url}</div>
            </div>
            {editable && (
              <button className="bookmark-row-del bookmark-large-del" onClick={(e) => onDelete(e, b)}
                      title="Delete bookmark"><XIcon size={10} /></button>
            )}
          </a>
        ))}
        {editable && (
          <button className="bookmark-add-row" onClick={onAddClick}>
            <span style={{ display: 'inline-flex', verticalAlign: '-1px', marginRight: 6 }}>
              <PlusIcon size={11} />
            </span>
            Add bookmark
          </button>
        )}
        {list.length === 0 && !editable && <div className="muted" style={{padding: 12}}>No bookmarks yet — add to layout.yml.</div>}
      </div>
      {adding && <AddBookmarkModal
        onSave={(form) => { create(form); setAdding(false); }}
        onClose={() => setAdding(false)} />}
    </Panel>
  );
}

registerWidget('bookmarks', BookmarksWidget);
