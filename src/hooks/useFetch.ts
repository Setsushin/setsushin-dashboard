// useFetch — TTL cache via sessionStorage, fallback on failure.

import { useEffect, useState } from 'react';

export interface UseFetchOptions<T> {
  ttl?: number;
  fallback?: T | null;
}

export interface FetchState<T> {
  loading: boolean;
  data: T | null;
  error: Error | null;
}

export function useFetch<T = unknown>(
  url: string | null,
  opts: UseFetchOptions<T> = {},
): FetchState<T> {
  const { ttl = 300_000, fallback = null } = opts;
  const [state, setState] = useState<FetchState<T>>({
    loading: !!url,
    data: fallback,
    error: null,
  });

  useEffect(() => {
    if (!url) {
      setState({ loading: false, data: fallback, error: null });
      return;
    }
    const cacheKey = `cache:${url}`;
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw) as { t: number; d: T };
        if (Date.now() - cached.t < ttl) {
          setState({ loading: false, data: cached.d, error: null });
          return;
        }
      }
    } catch {
      /* ignore cache read errors */
    }

    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    fetch(url)
      .then((r) => (r.ok ? (r.json() as Promise<T>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => {
        if (cancelled) return;
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), d }));
        } catch {
          /* quota — non-fatal */
        }
        setState({ loading: false, data: d, error: null });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState({ loading: false, data: fallback, error: err });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}
