// useLayout — yaml structure + D1 grid overrides + per-page meta overrides.
// Three layers merged per page:
//   1. layout.yml (template — nav, page list, stats, default grids)
//   2. /api/layout → { [page_id]: grid_array }   per-page grid overrides
//   3. /api/pages  → [{page_id, label, icon, title, subtitle, ...}]
//        - page_id in yaml  → override label/icon/title/subtitle (when set)
//        - page_id not in yaml → synthesize a new page + nav entry
// Either /api/* failure is non-fatal — we degrade to whatever loaded.

import { useCallback, useEffect, useMemo, useState } from 'react';
import yaml from 'js-yaml';
import type { GridItem, Layout, LayoutYaml, NavItem, Page, PageMeta } from '../types';

type Overrides = Record<string, GridItem[]>;

interface State {
  loading: boolean;
  yaml: LayoutYaml | null;
  overrides: Overrides;
  pagesMeta: PageMeta[];
  error: Error | null;
}

export interface UseLayoutResult {
  loading: boolean;
  layout: Layout | null;
  error: Error | null;
  reloadOverrides: () => void;
  setOverrideLocal: (pageId: string, grid: GridItem[] | null) => void;
  reloadPagesMeta: () => void;
  setPageMetaLocal: (pageId: string, meta: Omit<PageMeta, 'page_id'> | null) => void;
}

export function useLayout(): UseLayoutResult {
  const [state, setState] = useState<State>({
    loading: true,
    yaml: null,
    overrides: {},
    pagesMeta: [],
    error: null,
  });

  const loadOverrides = useCallback(
    (): Promise<Overrides> =>
      fetch('/api/layout')
        .then((r) => (r.ok ? (r.json() as Promise<Overrides>) : {}))
        .catch(() => ({})),
    [],
  );
  const loadPagesMeta = useCallback(
    (): Promise<PageMeta[]> =>
      fetch('/api/pages')
        .then((r) => (r.ok ? (r.json() as Promise<PageMeta[]>) : []))
        .catch(() => []),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      // Bump ?v= whenever layout.yml changes — CF's edge caches it.
      fetch('layout.yml?v=2')
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((t) => yaml.load(t) as LayoutYaml),
      loadOverrides(),
      loadPagesMeta(),
    ])
      .then(([loaded, overrides, pagesMeta]) => {
        if (cancelled) return;
        setState({
          loading: false,
          yaml: loaded,
          overrides: overrides || {},
          pagesMeta: pagesMeta || [],
          error: null,
        });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        console.error('layout load failed:', err);
        setState({ loading: false, yaml: null, overrides: {}, pagesMeta: [], error: err });
      });
    return () => {
      cancelled = true;
    };
  }, [loadOverrides, loadPagesMeta]);

  const reloadOverrides = useCallback(() => {
    void loadOverrides().then((o) => setState((s) => ({ ...s, overrides: o || {} })));
  }, [loadOverrides]);
  const reloadPagesMeta = useCallback(() => {
    void loadPagesMeta().then((m) => setState((s) => ({ ...s, pagesMeta: m || [] })));
  }, [loadPagesMeta]);

  const setOverrideLocal = useCallback((pageId: string, grid: GridItem[] | null) => {
    setState((s) => {
      const next = { ...s.overrides };
      if (grid == null) delete next[pageId];
      else next[pageId] = grid;
      return { ...s, overrides: next };
    });
  }, []);

  const setPageMetaLocal = useCallback(
    (pageId: string, meta: Omit<PageMeta, 'page_id'> | null) => {
      setState((s) => {
        const without = s.pagesMeta.filter((m) => m.page_id !== pageId);
        const next = meta == null ? without : [...without, { page_id: pageId, ...meta }];
        return { ...s, pagesMeta: next };
      });
    },
    [],
  );

  const layout = useMemo<Layout | null>(() => {
    if (!state.yaml) return null;
    const ymlPages: Page[] = Array.isArray(state.yaml.pages) ? state.yaml.pages : [];
    const ymlNav: NavItem[] = Array.isArray(state.yaml.nav) ? state.yaml.nav : [];
    const yamlPageIds = new Set(ymlPages.map((p) => p.id));
    const metaById = Object.fromEntries((state.pagesMeta || []).map((m) => [m.page_id, m]));

    // 1. Yaml pages — apply meta overrides + grid override.
    const mergedYamlPages: Page[] = ymlPages.map((p) => {
      const meta = metaById[p.id];
      const grid = state.overrides[p.id] !== undefined ? state.overrides[p.id] : p.grid;
      return {
        ...p,
        title: meta?.title ?? p.title,
        subtitle: meta?.subtitle ?? p.subtitle,
        grid,
      };
    });
    // 2. Synthesize pages for user-added meta rows.
    const userPages: Page[] = (state.pagesMeta || [])
      .filter((m) => !yamlPageIds.has(m.page_id))
      .sort((a, b) => (a.sort_order ?? 100) - (b.sort_order ?? 100))
      .map((m) => ({
        id: m.page_id,
        title: m.title || m.label || undefined,
        subtitle: m.subtitle ?? undefined,
        grid: state.overrides[m.page_id] || [],
        userAdded: true,
      }));

    // 3. Build nav: yaml nav (with meta override) + user-added entries.
    const mergedYamlNav: NavItem[] = ymlNav.map((n) => {
      const meta = metaById[n.id];
      return { ...n, label: meta?.label ?? n.label, icon: meta?.icon ?? n.icon };
    });
    const userNav: NavItem[] = userPages.map((p) => {
      const meta = metaById[p.id];
      return { id: p.id, label: meta?.label || p.id, icon: meta?.icon || 'icons/more.svg' };
    });

    return {
      ...state.yaml,
      pages: [...mergedYamlPages, ...userPages],
      nav: [...mergedYamlNav, ...userNav],
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
