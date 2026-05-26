// useTweaks — single source of truth for design-tweak values. setTweak
// persists via the design-tool host (__edit_mode_set_keys → host rewrites the
// EDITMODE block on disk).

import { useCallback, useState } from 'react';

export interface SetTweak<T> {
  <K extends keyof T>(key: K, value: T[K]): void;
  (edits: Partial<T>): void;
}

export function useTweaks<T extends object>(defaults: T): [T, SetTweak<T>] {
  const [values, setValues] = useState<T>(defaults);

  // Accepts setTweak('key', value) or setTweak({ key: value, ... }).
  const setTweak = useCallback(((keyOrEdits: keyof T | Partial<T>, val?: unknown) => {
    const edits: Partial<T> =
      typeof keyOrEdits === 'object' && keyOrEdits !== null
        ? keyOrEdits
        : ({ [keyOrEdits]: val } as Partial<T>);
    setValues((prev) => ({ ...prev, ...edits }));
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits }, '*');
  }) as SetTweak<T>, []);

  return [values, setTweak];
}
