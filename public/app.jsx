// app.jsx — root composition. Pulls the shell + grid/edit + widgets +
// tweaks panel together. Renders nothing on its own; boot.jsx mounts it.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "tone": "warm",
  "accent": "#d97757",
  "radius": "round",
  "density": "regular",
  "sidebar": "light",
  "mode": "light",
  "userName": ""
}/*EDITMODE-END*/;

function nameFromEmail(email) {
  if (!email) return '';
  const local = email.split('@')[0].replace(/[._-]+/g, ' ').trim();
  return local
    ? local.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : '';
}

// Mix accent → cream at 28% to derive --accent-soft live so user-picked
// custom accents stay readable on warm backgrounds.
function hexToSoft(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 'rgba(217, 119, 87, 0.22)';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const bg = [251, 247, 240];
  const mix = (a, b, t) => Math.round(a * t + b * (1 - t));
  return `rgb(${mix(r, bg[0], 0.28)}, ${mix(g, bg[1], 0.28)}, ${mix(b, bg[2], 0.28)})`;
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [me, setMe] = React.useState(null);
  React.useEffect(() => {
    fetch('/api/me').then(r => r.ok ? r.json() : null).then(setMe).catch(() => {});
  }, []);
  const displayName = (t.userName?.trim()) || nameFromEmail(me?.email) || 'You';
  const {
    loading: layoutLoading, layout, error: layoutError,
    reloadOverrides, setOverrideLocal,
    reloadPagesMeta, setPageMetaLocal,
  } = useLayout();
  const [editMode, setEditMode] = React.useState(false);
  // Mobile-only sidebar drawer. Toggled by the hamburger in TopBar; CSS hides
  // both the button and the drawer at >768px so this state is a no-op on desktop.
  const [navOpen, setNavOpen] = React.useState(false);
  // pageMetaModal: null | { mode: 'add'|'edit', initial: {...} }
  const [pageMetaModal, setPageMetaModal] = React.useState(null);
  // taskModal: null | 'add' | <task object>.  Lifted out of TasksWidget so
  // Quick Capture (sidebar), the global N hotkey, and any widget that
  // wants to open the form (compact tasks, journal, …) all hit the same
  // dialog instance — no per-page tie-breaker, no need for a tasks widget
  // to be mounted on the current page.  Widgets dispatch
  // `open-task-modal` { detail: { task? } } to request open.
  const [taskModal, setTaskModal] = React.useState(null);
  const closeTaskModal = React.useCallback(() => setTaskModal(null), []);

  React.useEffect(() => {
    const openAdd = () => setTaskModal(prev => prev ?? 'add');
    const openWithDetail = (e) => setTaskModal(e?.detail?.task || 'add');
    const onKey = (e) => {
      if (taskModal !== null || pageMetaModal !== null) return;
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.target?.isContentEditable) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openAdd(); }
    };
    window.addEventListener('focus-task-input', openAdd);
    window.addEventListener('open-task-modal', openWithDetail);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('focus-task-input', openAdd);
      window.removeEventListener('open-task-modal', openWithDetail);
      window.removeEventListener('keydown', onKey);
    };
  }, [taskModal, pageMetaModal]);

  React.useEffect(() => {
    document.body.dataset.tone = t.tone;
    document.body.dataset.density = t.density;
    document.body.dataset.sidebar = t.sidebar;
    document.body.dataset.radius = t.radius;
    document.body.dataset.mode = t.mode;
    document.documentElement.style.setProperty('--accent', t.accent);
    document.documentElement.style.setProperty('--accent-soft', hexToSoft(t.accent));
  }, [t]);

  React.useEffect(() => {
    if (layout?.brand) document.title = `${displayName || layout.brand} · Dashboard`;
  }, [layout, displayName]);

  const today = new Date();
  // Editorial mono date stamp — short month, zero-padded day, separator dots.
  // CSS uppercases & sets in mono so we don't fight locale formatting here.
  const month = today.toLocaleDateString('en-US', { month: 'short' });
  const day = String(today.getDate()).padStart(2, '0');
  const year = today.getFullYear();
  const dateStr = `${month} · ${day} · ${year}`;
  const weekday = today.toLocaleDateString('en-US', { weekday: 'short' });

  const hash = useHashRoute();

  // Switching pages while editing exits edit mode (drops the draft) so we
  // don't accidentally PUT the wrong page's draft. If you want to keep
  // edits across pages later, hoist the draft into App and key it by page.id.
  // Also closes the mobile nav drawer after a nav-click navigates.
  React.useEffect(() => { setEditMode(false); setNavOpen(false); }, [hash]);

  // ESC closes the mobile nav drawer.
  React.useEffect(() => {
    if (!navOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setNavOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  if (layoutLoading) return <div className="boot">Loading layout…</div>;
  if (layoutError) return <div className="boot boot-err">Failed to load layout.yml: {String(layoutError.message)}</div>;

  const pages = layout.pages || [];
  const pageIds = new Set(pages.map(p => p.id));
  const page = pages.find(p => p.id === hash) || pages[0];

  const onSaveLayout = async (grid) => {
    if (!page) return;
    setOverrideLocal(page.id, grid);
    try {
      const r = await fetch('/api/layout', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ page_id: page.id, grid }),
      });
      if (!r.ok) throw new Error(`PUT failed: HTTP ${r.status}`);
      setEditMode(false);
    } catch (err) {
      console.error('layout save failed:', err);
      alert(`Save failed: ${err.message}\nYour changes are still in the editor.`);
      reloadOverrides();
    }
  };

  // ── Page meta CRUD ─────────────────────────────────────────────────
  // Both add and edit funnel through PUT /api/pages/<id>. Add navigates
  // to the new page on success; edit just refreshes the meta state.
  const onSavePageMeta = async (form) => {
    const isAdd = pageMetaModal?.mode === 'add';
    setPageMetaLocal(form.page_id, {
      label: form.label, icon: form.icon, title: form.title, subtitle: form.subtitle,
    });
    setPageMetaModal(null);
    try {
      const r = await fetch(`/api/pages/${encodeURIComponent(form.page_id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(`PUT failed: HTTP ${r.status}`);
      reloadPagesMeta();
      if (isAdd) window.location.hash = form.page_id;
    } catch (err) {
      console.error('page meta save failed:', err);
      alert(`Save failed: ${err.message}`);
      reloadPagesMeta();
    }
  };

  // Delete is only ever invoked for user-added pages (the modal hides the
  // button for yaml pages — Reset to default is the equivalent there).
  const onDeletePage = async (pageId) => {
    if (!window.confirm(`Delete page "${pageId}" and its layout? This cannot be undone.`)) return;
    setPageMetaLocal(pageId, null);
    setOverrideLocal(pageId, null);
    setPageMetaModal(null);
    try {
      const r = await fetch(`/api/pages/${encodeURIComponent(pageId)}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(`DELETE failed: HTTP ${r.status}`);
      reloadPagesMeta();
      reloadOverrides();
      // App auto-falls back to pages[0] if hash no longer matches.
      if (window.location.hash.slice(1) === pageId) window.location.hash = '';
    } catch (err) {
      console.error('page delete failed:', err);
      alert(`Delete failed: ${err.message}`);
      reloadPagesMeta();
      reloadOverrides();
    }
  };

  const onResetPage = async () => {
    if (!page) return;
    if (!window.confirm(`Reset "${page.id}" to layout.yml default?`)) return;
    try {
      const r = await fetch(`/api/layout?page_id=${encodeURIComponent(page.id)}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(`DELETE failed: HTTP ${r.status}`);
      setOverrideLocal(page.id, null);
      setEditMode(false);
    } catch (err) {
      console.error('layout reset failed:', err);
      alert(`Reset failed: ${err.message}`);
    }
  };

  return (
    <div className="app">
      <Sidebar brand={displayName} nav={layout.nav} activeId={page?.id} pageIds={pageIds}
               onAddPage={() => setPageMetaModal({ mode: 'add', initial: null })}
               open={navOpen} onClose={() => setNavOpen(false)} />
      <main className="main">
        <TopBar
          mode={t.mode}
          onToggleMode={() => {
            const nextMode = t.mode === 'dark' ? 'light' : 'dark';
            // Sidebar tracks mode by default — flip both. The user can still
            // explicitly diverge via the TweaksPanel sidebar control afterwards.
            setTweak({ mode: nextMode, sidebar: nextMode });
          }}
          editMode={editMode}
          onToggleEditMode={() => setEditMode(v => !v)}
          onMenuClick={() => setNavOpen(true)}
          me={me}
        />
        <div className="content" data-screen-label={page?.id} data-edit-mode={editMode || undefined}>
          <PageHeader name={displayName} dateStr={dateStr} weekday={weekday}
                      title={page?.title} subtitle={page?.subtitle} />
          <StatStrip stats={page?.stats} />
          <HeaderStrip items={page?.header} />
          {editMode && page
            ? <EditableGrid page={page} onSave={onSaveLayout}
                            onCancel={() => setEditMode(false)} onResetPage={onResetPage}
                            onEditPageMeta={() => setPageMetaModal({
                              mode: 'edit',
                              initial: {
                                page_id: page.id,
                                label: layout.nav.find(n => n.id === page.id)?.label || '',
                                icon:  layout.nav.find(n => n.id === page.id)?.icon  || 'icons/more.svg',
                                title: page.title || '',
                                subtitle: page.subtitle || '',
                                userAdded: !!page.userAdded,
                              },
                            })} />
            : <DashboardGrid items={page?.grid} />}
        </div>
        <div className="footer">
          <span>Simplicity is the ultimate sophistication.</span>
          <span className="att">— Leonardo da Vinci</span>
        </div>
      </main>

      {pageMetaModal && (
        <PageMetaModal
          mode={pageMetaModal.mode}
          initial={pageMetaModal.initial}
          existingIds={pages.map(p => p.id)}
          onSave={onSavePageMeta}
          onDelete={pageMetaModal.mode === 'edit'
            ? () => onDeletePage(pageMetaModal.initial.page_id) : undefined}
          onClose={() => setPageMetaModal(null)}
        />
      )}

      {/* Single global TaskFormModal instance. TaskFormModal is declared in
          widgets/tasks.jsx (loads earlier, becomes a top-level identifier). */}
      <TaskFormModal
        open={taskModal !== null}
        task={(taskModal && typeof taskModal === 'object') ? taskModal : null}
        onClose={closeTaskModal}
      />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme" />
        <TweakRadio label="Mode" value={t.mode}
          options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
          onChange={(v) => setTweak('mode', v)} />
        <TweakRadio label="Tone" value={t.tone}
          options={[
            { value: 'warm', label: 'Warm' },
            { value: 'sage', label: 'Sage' },
            { value: 'cool', label: 'Cool' },
            { value: 'lavender', label: 'Lilac' },
          ]}
          onChange={(v) => {
            const accentByTone = { warm: '#d97757', sage: '#6f8e5a', cool: '#5b6cff', lavender: '#9a72c4' };
            setTweak({ tone: v, accent: accentByTone[v] });
          }} />
        <TweakColor label="Accent color" value={t.accent}
          onChange={(v) => setTweak('accent', v)} />
        <TweakRadio label="Sidebar" value={t.sidebar}
          options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]}
          onChange={(v) => setTweak('sidebar', v)} />

        <TweakSection label="Layout" />
        <TweakRadio label="Roundness" value={t.radius}
          options={[
            { value: 'square', label: 'Subtle' },
            { value: 'round', label: 'Soft' },
            { value: 'extra', label: 'Pillowy' },
          ]}
          onChange={(v) => setTweak('radius', v)} />
        <TweakRadio label="Density" value={t.density}
          options={[
            { value: 'compact', label: 'Compact' },
            { value: 'regular', label: 'Regular' },
            { value: 'comfy', label: 'Comfy' },
          ]}
          onChange={(v) => setTweak('density', v)} />

        <TweakSection label="Identity" />
        <TweakText label="Name" value={t.userName}
          placeholder={nameFromEmail(me?.email) || 'from login'}
          onChange={(v) => setTweak('userName', v)} />
      </TweaksPanel>
    </div>
  );
}
