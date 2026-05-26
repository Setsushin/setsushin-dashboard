// ToastHost — a single instance rendered by App that listens on the toast
// event bus (lib/events) and renders an auto-dismissing stack. Replaces the
// blocking window.alert() calls that widgets used for mutation failures.

import { useEffect, useState } from 'react';
import { onToast, type ToastDetail } from '../lib/events';
import './Toast.css';

interface ToastItem extends ToastDetail {
  id: number;
}

const TIMEOUT = 4500;

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(
    () =>
      onToast((t) => {
        const id = Date.now() + Math.random();
        setToasts((prev) => [...prev, { ...t, id }]);
        window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), TIMEOUT);
      }),
    [],
  );

  const dismiss = (id: number) => setToasts((prev) => prev.filter((x) => x.id !== id));
  if (toasts.length === 0) return null;

  return (
    <div className="toast-host">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.tone}`}
          role={t.tone === 'error' ? 'alert' : 'status'}
          aria-live={t.tone === 'error' ? 'assertive' : 'polite'}
        >
          <span className="toast-msg">{t.message}</span>
          <button className="toast-close" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
