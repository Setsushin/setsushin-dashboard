// core.jsx — runtime foundations consumed by every other script.
//
// Provides:
//   - Hooks:    useFetch / useLayout / useHashRoute / useTasksList
//   - Registry: WIDGETS / registerWidget / WidgetContext / normalizeItem /
//               useWidgetSize
//   - Shell:    Panel / mockHint
//
// Loaded right after tweaks-panel.jsx and before shell.jsx + widgets/*.jsx
// so all downstream scripts can rely on these primitives at parse/render
// time. Function declarations are global by virtue of being top-level in a
// classic <script>; explicit window.X = X assignments are kept on
// non-function bindings (e.g. WidgetContext) and as a "public API" marker.

const { useState, useEffect } = React;

// ── useFetch — TTL cache via sessionStorage, fallback on failure ──────
function useFetch(url, opts = {}) {
  const { ttl = 300_000, fallback = null } = opts;
  const [state, setState] = useState({ loading: !!url, data: fallback, error: null });

  useEffect(() => {
    if (!url) {
      setState({ loading: false, data: fallback, error: null });
      return;
    }
    const cacheKey = `cache:${url}`;
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw);
        if (Date.now() - cached.t < ttl) {
          setState({ loading: false, data: cached.d, error: null });
          return;
        }
      }
    } catch {}

    let cancelled = false;
    setState(s => ({ ...s, loading: true }));
    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => {
        if (cancelled) return;
        try { sessionStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), d })); } catch {}
        setState({ loading: false, data: d, error: null });
      })
      .catch(err => {
        if (cancelled) return;
        setState({ loading: false, data: fallback, error: err });
      });
    return () => { cancelled = true; };
  }, [url]);

  return state;
}

// ── useLayout — yaml structure + D1 grid + page-meta overrides ────────
// Three layers merged per page:
//   1. layout.yml (the template — nav, page list, stats, default grids)
//   2. /api/layout    → { [page_id]: grid_array }   per-page grid overrides
//   3. /api/pages     → [{page_id, label, icon, title, subtitle, ...}]
//        - if page_id matches a yaml page → label/icon/title/subtitle
//          (when non-null) override the yaml defaults
//        - if page_id is NOT in yaml → synthesize a brand-new page +
//          nav entry from this row alone (user-added pages)
// Either /api/* failure is non-fatal — we degrade to whatever loaded.
//
// reload* / set*Local helpers let edit UIs apply optimistic updates
// before the PUT/DELETE round-trips and re-fetch after persistence.
function useLayout() {
  const [state, setState] = useState({
    loading: true, yaml: null, overrides: {}, pagesMeta: [], error: null,
  });

  const loadOverrides = React.useCallback(() => {
    return fetch('/api/layout').then(r => r.ok ? r.json() : {}).catch(() => ({}));
  }, []);
  const loadPagesMeta = React.useCallback(() => {
    return fetch('/api/pages').then(r => r.ok ? r.json() : []).catch(() => []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('layout.yml').then(r => r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))).then(t => jsyaml.load(t)),
      loadOverrides(),
      loadPagesMeta(),
    ])
      .then(([yaml, overrides, pagesMeta]) => {
        if (cancelled) return;
        setState({ loading: false, yaml, overrides: overrides || {},
                   pagesMeta: pagesMeta || [], error: null });
      })
      .catch(err => {
        if (cancelled) return;
        console.error('layout load failed:', err);
        setState({ loading: false, yaml: null, overrides: {}, pagesMeta: [], error: err });
      });
    return () => { cancelled = true; };
  }, [loadOverrides, loadPagesMeta]);

  const reloadOverrides = React.useCallback(() => {
    loadOverrides().then(o => setState(s => ({ ...s, overrides: o || {} })));
  }, [loadOverrides]);
  const reloadPagesMeta = React.useCallback(() => {
    loadPagesMeta().then(m => setState(s => ({ ...s, pagesMeta: m || [] })));
  }, [loadPagesMeta]);

  const setOverrideLocal = React.useCallback((pageId, grid) => {
    setState(s => {
      const next = { ...s.overrides };
      if (grid == null) delete next[pageId]; else next[pageId] = grid;
      return { ...s, overrides: next };
    });
  }, []);

  // Patch one page's meta in place, or remove if `meta` is null. Used for
  // optimistic Save / Delete in the page-settings UI.
  const setPageMetaLocal = React.useCallback((pageId, meta) => {
    setState(s => {
      const without = s.pagesMeta.filter(m => m.page_id !== pageId);
      const next = meta == null ? without : [...without, { page_id: pageId, ...meta }];
      return { ...s, pagesMeta: next };
    });
  }, []);

  const layout = React.useMemo(() => {
    if (!state.yaml) return null;
    const yaml = state.yaml;
    const yamlPages = Array.isArray(yaml.pages) ? yaml.pages : [];
    const yamlNav   = Array.isArray(yaml.nav)   ? yaml.nav   : [];
    const yamlPageIds = new Set(yamlPages.map(p => p.id));
    const metaById = Object.fromEntries((state.pagesMeta || []).map(m => [m.page_id, m]));

    // 1. Yaml pages — apply meta overrides + grid override
    const mergedYamlPages = yamlPages.map(p => {
      const meta = metaById[p.id];
      const grid = state.overrides[p.id] !== undefined ? state.overrides[p.id] : p.grid;
      return {
        ...p,
        title:    meta?.title    ?? p.title,
        subtitle: meta?.subtitle ?? p.subtitle,
        grid,
      };
    });
    // 2. Synthesize pages for user-added meta rows
    const userPages = (state.pagesMeta || [])
      .filter(m => !yamlPageIds.has(m.page_id))
      .sort((a, b) => (a.sort_order ?? 100) - (b.sort_order ?? 100))
      .map(m => ({
        id: m.page_id,
        title: m.title || m.label,
        subtitle: m.subtitle,
        grid: state.overrides[m.page_id] || [],
        userAdded: true,
      }));

    // 3. Build nav: yaml nav (with meta override on label/icon) + user-added entries
    const yamlNavById = new Map(yamlNav.map(n => [n.id, n]));
    const mergedYamlNav = yamlNav.map(n => {
      const meta = metaById[n.id];
      return {
        ...n,
        label: meta?.label ?? n.label,
        icon:  meta?.icon  ?? n.icon,
      };
    });
    const userNav = userPages.map(p => {
      const meta = metaById[p.id];
      return {
        id: p.id,
        label: meta?.label || p.id,
        icon:  meta?.icon  || 'icons/more.svg',
      };
    });

    return {
      ...yaml,
      pages: [...mergedYamlPages, ...userPages],
      nav:   [...mergedYamlNav,   ...userNav],
    };
  }, [state.yaml, state.overrides, state.pagesMeta]);

  return {
    loading: state.loading,
    layout,
    error: state.error,
    reloadOverrides,
    setOverrideLocal,
    reloadPagesMeta,
    setPageMetaLocal,
  };
}

// ── useHashRoute — current location.hash without the leading '#'. ─────
function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash.slice(1));
  useEffect(() => {
    const onChange = () => setHash(window.location.hash.slice(1));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

// ── useTasksList — D1-backed, refreshed on `tasks-updated` events. ────
// Returns [tasks, reload]. Pass enabled=false to skip the network call
// (Stat only fetches when a stat actually needs the list).
//
// `tasks-updated` event protocol:
//   • dispatch with detail.optimistic = { patch: [{id, ...fields}], removeIds: [id, ...] }
//     → mutate the local cache synchronously (no network); used to flip the
//       UI before a PATCH/DELETE round-trips. Both this widget and StatStrip
//       see the change immediately.
//   • dispatch with no detail (or no .optimistic key)
//     → reload from /api/tasks; used after a network mutation settles.
function useTasksList(enabled = true) {
  const [tasks, setTasks] = useState(null);
  const reload = React.useCallback(() => {
    if (!enabled) return;
    fetch('/api/tasks')
      .then(r => r.ok ? r.json() : [])
      .then(setTasks)
      .catch(() => setTasks([]));
  }, [enabled]);
  useEffect(() => {
    if (!enabled) { setTasks(null); return; }
    reload();
    const onUpdate = (e) => {
      const opt = e?.detail?.optimistic;
      if (opt) {
        setTasks(prev => {
          if (!prev) return prev;
          let next = prev;
          let changed = false;
          if (Array.isArray(opt.patch) && opt.patch.length) {
            const mapped = next.map(t => {
              const p = opt.patch.find(x => x.id === t.id);
              if (!p) return t;
              changed = true;
              return { ...t, ...p };
            });
            if (changed) next = mapped;
          }
          if (Array.isArray(opt.removeIds) && opt.removeIds.length) {
            const drop = new Set(opt.removeIds);
            const filtered = next.filter(t => !drop.has(t.id));
            if (filtered.length !== next.length) { next = filtered; changed = true; }
          }
          return changed ? next : prev;
        });
        return;
      }
      reload();
    };
    window.addEventListener('tasks-updated', onUpdate);
    return () => window.removeEventListener('tasks-updated', onUpdate);
  }, [enabled, reload]);
  return [tasks, reload];
}

// ── Widget registry ──────────────────────────────────────────────────
// Widgets self-register by calling registerWidget('type', Component) in
// their own *.jsx file. Order doesn't matter as long as registration
// happens before App's first render — boot.jsx ensures that.
window.WIDGETS = window.WIDGETS || {};
window.registerWidget = (type, component) => { window.WIDGETS[type] = component; };

// WidgetContext carries layout metadata into every widget so Panel can
// auto-id and span grid rows without each widget threading props through.
// Schema: {type, index, size, config} where size ∈ {'compact', 'large'}.
const WidgetContext = React.createContext({});
window.WidgetContext = WidgetContext;

// ── Free-form grid placement ─────────────────────────────────────────
// Each grid item now carries explicit {col, row, w, h}. Legacy items
// (no col/row, only size/fixedSize) get auto-placed on first read; once
// saved through edit mode they're stored as explicit positions in D1.
//
// Coordinate system: 1-based, 3 columns. col + w − 1 must be ≤ GRID_COLS.
// Row is unbounded (grid auto-rows handle vertical growth). Collision
// resolution only pushes items DOWN (monotonic → terminates).
const GRID_COLS = 3;
window.GRID_COLS = GRID_COLS;

// Derive {w, h} for an item from its persisted fields, falling back to
// the older size/fixedSize signals so legacy data renders identically.
function itemFootprint(item) {
  const Component = window.WIDGETS[item.type];
  const fixed = Component?.fixedSize;
  const sizeIsCompact = item.size === 'compact';
  const w = Number.isInteger(item.w)
    ? Math.min(GRID_COLS, Math.max(1, item.w))
    : (fixed?.full ? GRID_COLS : 1);
  const h = Number.isInteger(item.h)
    ? Math.max(1, item.h)
    : (fixed?.rowSpan ?? (sizeIsCompact ? 1 : 2));
  return { w, h };
}

function gridOverlaps(a, b) {
  return !(a.col + a.w <= b.col || b.col + b.w <= a.col ||
           a.row + a.h <= b.row || b.row + b.h <= a.row);
}

// Scan rows top-down, left-to-right for the first cell that fits w×h
// without overlapping anything in `placed`.
function findFreeCell(placed, w, h) {
  for (let row = 1; row < 1000; row++) {
    for (let col = 1; col + w - 1 <= GRID_COLS; col++) {
      const probe = { col, row, w, h };
      if (!placed.some(p => gridOverlaps(probe, p))) return { col, row };
    }
  }
  return { col: 1, row: 1 };
}

// Fill in {w, h, col, row} for every item. Items with valid existing
// col/row keep them; the rest are flow-placed in array order so they
// don't overlap anyone already placed.
function placeItems(items) {
  const result = [];
  for (const it of items ?? []) {
    const { w, h } = itemFootprint(it);
    const out = { ...it, w, h };
    const hasPos = Number.isInteger(it.col) && Number.isInteger(it.row)
                   && it.col >= 1 && it.col + w - 1 <= GRID_COLS && it.row >= 1;
    if (hasPos) {
      out.col = it.col; out.row = it.row;
    } else {
      const pos = findFreeCell(result, w, h);
      out.col = pos.col; out.row = pos.row;
    }
    result.push(out);
  }
  return result;
}

// After an item moves, push everything else DOWN until no overlaps remain.
// `anchorIdx` is the moved item — it never gets pushed. Bounded iterations
// guard against pathological cases.
function resolveCollisions(items, anchorIdx) {
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
        next = next.map((x, j) => j === i ? { ...x, row: newRow } : x);
        changed = true;
      }
    }
  }
  return next;
}

window.itemFootprint = itemFootprint;
window.gridOverlaps = gridOverlaps;
window.findFreeCell = findFreeCell;
window.placeItems = placeItems;
window.resolveCollisions = resolveCollisions;

// Normalize a layout.yml grid item: ensure size ∈ {'compact','large'} and
// fill in {w, h} from item/fixedSize defaults. col/row are filled by
// placeItems (which needs a global view).
function normalizeItem(item) {
  const size = item.size === 'compact' ? 'compact' : 'large';
  const { w, h } = itemFootprint(item);
  return { ...item, size, w, h };
}

// useWidgetSize: returns 'compact' or 'large'. Widgets switch between two
// body renderings based on this (e.g. markets compact = top mover only).
function useWidgetSize() {
  const ctx = React.useContext(WidgetContext);
  return ctx.size === 'compact' ? 'compact' : 'large';
}

// ── Panel — shared widget shell ──────────────────────────────────────
// large size spans 2 grid rows; compact is 1. Children scroll inside
// `.panel-body` so widgets don't push the row taller than --row-h.
function Panel({ title, hint, action, footer, children, className }) {
  const ctx = React.useContext(WidgetContext);
  const anchorId = ctx.type != null ? `widget-${ctx.type}-${ctx.index}` : undefined;
  const size = ctx.size === 'compact' ? 'compact' : 'large';
  const fixed = ctx.type != null ? window.WIDGETS[ctx.type]?.fixedSize : null;
  // Explicit grid placement when ctx carries placed coords (DashboardGrid /
  // EditableGrid both pass items through placeItems before rendering).
  // When the widget is rendered outside a grid (e.g. HeaderStrip rendering
  // bookmarks in row mode), ctx has no col/row → no grid style is set.
  const style = (Number.isInteger(ctx.col) && Number.isInteger(ctx.row))
    ? { gridColumn: `${ctx.col} / span ${ctx.w}`,
        gridRow:    `${ctx.row} / span ${ctx.h}` }
    : undefined;
  return (
    <section id={anchorId}
             className={`panel ${className ?? ''}`}
             data-size={fixed ? 'fixed' : size}
             style={style}>
      <div className="panel-head">
        <div className="panel-title">
          {title}
          {hint && <span className="panel-hint">{hint}</span>}
        </div>
        {action}
      </div>
      <div className="panel-body">{children}</div>
      {footer && <div className="panel-foot">{footer}</div>}
    </section>
  );
}

// ── Shared icon primitives ────────────────────────────────────────────
// Inline SVGs, not <img>, so they inherit `currentColor` from their
// parent button/text — survives both light/dark mode without filter
// hacks. Use these instead of "+"/"×" text characters: text glyphs sit
// off-center in many sans fonts, while these always render dead-center
// inside any flex/grid box.
function PlusIcon({ size = 12 }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M8 2v12M2 8h12" />
    </svg>
  );
}
function XIcon({ size = 12 }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 3l10 10M13 3L3 13" />
    </svg>
  );
}
window.PlusIcon = PlusIcon;
window.XIcon = XIcon;

// Derive a "(mock — reason)" hint from useFetch state + upstream sentinel
// (the case where Worker returns 200 but every entry has an `error`
// field — see widgets/markets.jsx, widgets/calendar.jsx).
function mockHint({ error, allErrored, reason }) {
  if (!error && !allErrored) return null;
  const why = reason || (error && error.message) || (allErrored && 'upstream blocked') || 'unreachable';
  return `(mock — ${why})`;
}
