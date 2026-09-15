// useLayout — loads public/layout.yml (nav + pages + grids).

import { useEffect, useState } from 'react';
import yaml from 'js-yaml';
import type { Layout, LayoutYaml } from '../types';

export interface UseLayoutResult {
  loading: boolean;
  layout: Layout | null;
  error: Error | null;
}

export function useLayout(): UseLayoutResult {
  const [state, setState] = useState<UseLayoutResult>({ loading: true, layout: null, error: null });

  useEffect(() => {
    let cancelled = false;
    // Bump ?v= whenever layout.yml changes — CF's edge caches it.
    fetch('layout.yml?v=4')
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((t) => yaml.load(t) as LayoutYaml)
      .then((loaded) => {
        if (cancelled) return;
        setState({
          loading: false,
          layout: {
            ...loaded,
            pages: Array.isArray(loaded.pages) ? loaded.pages : [],
            nav: Array.isArray(loaded.nav) ? loaded.nav : [],
          },
          error: null,
        });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        console.error('layout load failed:', err);
        setState({ loading: false, layout: null, error: err });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
