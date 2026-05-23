// shell.jsx — chrome around the grid: sidebar, top bar, page header,
// header strip, stat strip, dashboard grid. Read-only consumers of
// core.jsx primitives (useFetch / useTasksList / WidgetContext /
// normalizeItem / Panel). App composes these in app.jsx.

// nav.id matches a page.id → click changes URL hash → App re-renders.
// If a nav.id has no matching page, click falls back to scrolling to a
// widget with matching id on the current page (legacy single-page mode).
function Sidebar({ brand, nav, activeId, pageIds, onAddPage, open, onClose }) {
  const onClick = (id) => {
    if (pageIds.has(id)) {
      window.location.hash = id;
    } else {
      const el = document.querySelector(`#widget-${id}-0`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (onClose) onClose();
  };
  const dataOpen = open ? 'true' : undefined;
  return (
    <>
      <div className="sidebar-backdrop" data-open={dataOpen} onClick={onClose} />
      <aside className="sidebar" data-open={dataOpen}>
        <div className="sb-brand">
          <div className="sb-brand-mark">{(brand && brand[0]) ? brand[0].toUpperCase() : 'S'}</div>
          <div className="sb-brand-name">{brand}</div>
        </div>
        <nav className="sb-nav">
          {(nav ?? []).map((n) => (
            <button key={n.id}
                    className={`sb-item ${n.id === activeId ? 'is-active' : ''}`}
                    onClick={() => onClick(n.id)}>
              <img className="ico" src={n.icon} alt="" />
              <span>{n.label}</span>
              {n.badge && <span className="badge">{n.badge}</span>}
            </button>
          ))}
          {onAddPage && (
            <button className="sb-item sb-add-page"
                    onClick={() => { onAddPage(); if (onClose) onClose(); }}
                    title="Create a new page (label, icon, title, subtitle)">
              <span className="sb-add-plus">+</span>
              <span>Add page</span>
            </button>
          )}
        </nav>
        <div className="sb-quick-capture"
             onClick={() => {
               window.dispatchEvent(new CustomEvent('focus-task-input'));
               if (onClose) onClose();
             }}
             style={{cursor: 'pointer'}}
             title="Jump to Add task input">
          <img className="ico" src="icons/add.svg" alt="" style={{width: 14, height: 14}} />
          <span>Quick Capture</span>
          <span className="kbd">N</span>
        </div>
      </aside>
    </>
  );
}

function TopBar({ mode, onToggleMode, editMode, onToggleEditMode, onMenuClick, me }) {
  const isDark = mode === 'dark';
  const searchRef = React.useRef(null);

  // ⌘K (or Ctrl+K on non-Mac) focuses the search input from anywhere.
  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" aria-label="Open navigation" onClick={onMenuClick}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      <div className="search">
        <img className="search-ico" src="icons/search.svg" alt="" />
        <input ref={searchRef} placeholder="Search anything..." />
        <span className="search-kbd">⌘K</span>
      </div>
      <button className="icon-btn" aria-label="Toggle theme" onClick={onToggleMode} title={isDark ? 'Switch to light' : 'Switch to dark'}>
        {isDark ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
          </svg>
        )}
      </button>
      <button
        className={`icon-btn ${editMode ? 'is-active' : ''}`}
        aria-label="Toggle edit mode"
        onClick={onToggleEditMode}
        title={editMode ? 'Exit edit mode' : 'Edit layout (drag, resize, add, remove)'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button className="icon-btn" aria-label="Notifications">
        <img src="icons/bell.svg" alt="" />
        <span className="dot"></span>
      </button>
      <UserMenu me={me} />
    </header>
  );
}

// Page yaml `title` sets the H1; `subtitle` renders below as a quiet caption.
// When no title is given the brand stands in — the dashboard owner needs no
// greeting and no time-of-day copy (PRODUCT.md: trust the user).
function PageHeader({ name, dateStr, weekday, title, subtitle }) {
  const h1 = title || name;
  const sub = title ? subtitle : null;
  return (
    <div className="page-head">
      <div className="page-head-title">
        <h1>{h1}</h1>
        {sub && <div className="page-head-sub">{sub}</div>}
      </div>
      <div className="page-head-date">
        <div className="page-head-date-w">{weekday}</div>
        <div className="page-head-date-d">{dateStr}</div>
      </div>
    </div>
  );
}

// Renders page.header[] as a full-width strip above the grid. Widgets opt into
// strip layout via config.layout === 'row' (see widgets/bookmarks.jsx).
function HeaderStrip({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="header-strip">
      {items.map((item, i) => {
        const Component = window.WIDGETS[item.type];
        if (!Component) return null;
        const norm = normalizeItem(item);
        return (
          <WidgetContext.Provider key={i} value={{ type: item.type, index: i, ...norm }}>
            <Component config={item.config} />
          </WidgetContext.Provider>
        );
      })}
    </div>
  );
}

// Hooks always run (Rules of Hooks); gated by enabled/null-url so unrelated
// stats no-op without paying for the network call.
function Stat({ config: s }) {
  const [tasks] = useTasksList(s.type === 'tasksRemaining');

  const feedUrl = s.type === 'feedCount' ? (s.endpoint || '/api/feed') : null;
  const { data: feedData } = useFetch(feedUrl, { ttl: 10 * 60_000, fallback: [] });

  let value = s.value ?? '—';
  let sub = s.sub ?? '';
  let bar = s.bar;

  if (s.type === 'tasksRemaining' && tasks) {
    const done = tasks.filter(t => t.done).length;
    const remaining = tasks.length - done;
    value = String(remaining);
    sub = `${done} done`;
    bar = tasks.length ? done / tasks.length : 0;
  } else if (s.type === 'feedCount' && Array.isArray(feedData)) {
    value = String(feedData.length);
  } else if (s.type === 'count' && Array.isArray(s.items)) {
    value = String(s.items.length);
  }

  return (
    <div className="stat">
      <div className="stat-head">
        <div className={`stat-icon ${s.accent ? 'accent' : ''}`}>
          <img src={s.icon} alt="" />
        </div>
        <span>{s.label}</span>
      </div>
      <div className="stat-value">{value}</div>
      {bar != null ? (
        <div>
          <div className="stat-sub" style={{marginBottom: 6}}>{sub}</div>
          <div className="stat-bar">
            <div className={`stat-bar-fill ${s.accent ? 'accent' : ''}`} style={{ width: `${Math.min(1, bar) * 100}%` }} />
          </div>
        </div>
      ) : (
        <div className="stat-sub">{sub}</div>
      )}
    </div>
  );
}

function StatStrip({ stats }) {
  if (!stats || stats.length === 0) return null;
  return (
    <div className="stats">
      {stats.map((s) => <Stat key={s.id} config={s} />)}
    </div>
  );
}

function DashboardGrid({ items }) {
  // placeItems fills in {col, row} for any item that doesn't carry them
  // (legacy data flowing in from layout.yml or pre-free-layout overrides).
  // Items that already have explicit positions keep them.
  const placed = placeItems(items ?? []);
  return (
    <div className="grid">
      {placed.map((item, i) => {
        const Component = window.WIDGETS[item.type];
        const cellStyle = {
          gridColumn: `${item.col} / span ${item.w}`,
          gridRow:    `${item.row} / span ${item.h}`,
        };
        if (!Component) {
          return (
            <section key={i} id={`widget-${item.type}-${i}`} className="panel"
                     style={cellStyle}>
              <div className="panel-head">
                <div className="panel-title">unknown widget: <code>{item.type}</code></div>
              </div>
              <div className="muted" style={{padding: 12}}>
                Did you forget to load <code>widgets/{item.type}.jsx</code> in index.html?
              </div>
            </section>
          );
        }
        return (
          <WidgetContext.Provider key={i} value={{ type: item.type, index: i, ...item }}>
            <Component config={item.config} />
          </WidgetContext.Provider>
        );
      })}
    </div>
  );
}
