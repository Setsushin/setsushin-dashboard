// App — root composition. Shell (sidebar, topbar, page header) around the
// page picked by the URL hash, plus the global task modal and tweaks panel.

import { useCallback, useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { PageHeader } from './components/PageHeader';
import { TweaksPanel, TweakSection, TweakRadio, TweakColor, TweakText } from './components/tweaks';
import { TaskFormModal } from './components/TaskFormModal';
import { ToastHost } from './components/Toast';
import { PAGES } from './pages';
import { useHashRoute } from './hooks/useHashRoute';
import { useTweaks } from './hooks/useTweaks';
import { onFocusTaskInput, onOpenTaskModal } from './lib/events';
import type { Me, Task } from './types';

interface Tweaks {
  accent: string;
  radius: string;
  density: string;
  sidebar: string;
  mode: string;
  userName: string;
}

const TWEAK_DEFAULTS: Tweaks = /*EDITMODE-BEGIN*/ {
  accent: '#1f4e79',
  radius: 'round',
  density: 'regular',
  sidebar: 'light',
  mode: 'light',
  userName: '',
} /*EDITMODE-END*/;

function nameFromEmail(email?: string): string {
  if (!email) return '';
  const local = email.split('@')[0].replace(/[._-]+/g, ' ').trim();
  return local
    ? local
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    : '';
}

type TaskModalState = Task | 'add' | null;

export function App() {
  const [t, setTweak] = useTweaks<Tweaks>(TWEAK_DEFAULTS);
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    fetch('/api/me')
      .then((r) => (r.ok ? (r.json() as Promise<Me>) : null))
      .then(setMe)
      .catch(() => {});
  }, []);
  const displayName = t.userName?.trim() || nameFromEmail(me?.email) || 'You';

  // Mobile-only sidebar drawer (CSS hides it >768px).
  const [navOpen, setNavOpen] = useState(false);
  // Single global task modal: null | 'add' | <task>.
  const [taskModal, setTaskModal] = useState<TaskModalState>(null);
  const closeTaskModal = useCallback(() => setTaskModal(null), []);

  useEffect(() => {
    const offFocus = onFocusTaskInput(() => setTaskModal((prev) => prev ?? 'add'));
    const offOpen = onOpenTaskModal((task?: Task) => setTaskModal(task || 'add'));
    const onKey = (e: KeyboardEvent) => {
      if (taskModal !== null) return;
      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (target?.isContentEditable) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setTaskModal((prev) => prev ?? 'add');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      offFocus();
      offOpen();
      window.removeEventListener('keydown', onKey);
    };
  }, [taskModal]);

  useEffect(() => {
    document.body.dataset.density = t.density;
    document.body.dataset.sidebar = t.sidebar;
    document.body.dataset.radius = t.radius;
    document.body.dataset.mode = t.mode;
    document.documentElement.style.setProperty('--accent-base', t.accent);
  }, [t]);

  useEffect(() => {
    document.title = `${displayName} · Dashboard`;
  }, [displayName]);

  const today = new Date();
  const month = today.toLocaleDateString('en-US', { month: 'short' });
  const day = String(today.getDate()).padStart(2, '0');
  const year = today.getFullYear();
  const dateStr = `${month} · ${day} · ${year}`;
  const weekday = today.toLocaleDateString('en-US', { weekday: 'short' });

  const hash = useHashRoute();
  const page = PAGES.find((p) => p.id === hash) ?? PAGES[0];

  useEffect(() => {
    setNavOpen(false);
  }, [hash]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  return (
    <div className="app">
      <Sidebar brand={displayName} pages={PAGES} activeId={page.id} open={navOpen} onClose={() => setNavOpen(false)} />
      <main className="main">
        <TopBar
          mode={t.mode}
          onToggleMode={() => {
            const nextMode = t.mode === 'dark' ? 'light' : 'dark';
            setTweak({ mode: nextMode, sidebar: nextMode });
          }}
          onMenuClick={() => setNavOpen(true)}
          me={me}
        />
        <div className="content" data-screen-label={page.id}>
          <PageHeader name={displayName} dateStr={dateStr} weekday={weekday} title={page.title} subtitle={page.subtitle} />
          <page.Component />
        </div>
        <div className="footer">
          <span>Simplicity is the ultimate sophistication.</span>
          <span className="att">— Leonardo da Vinci</span>
        </div>
      </main>

      <TaskFormModal
        open={taskModal !== null}
        task={taskModal && typeof taskModal === 'object' ? taskModal : null}
        onClose={closeTaskModal}
      />

      <ToastHost />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme" />
        <TweakRadio
          label="Mode"
          value={t.mode}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          onChange={(v) => setTweak('mode', v)}
        />
        <TweakColor label="Accent color" value={t.accent} onChange={(v) => setTweak('accent', v)} />
        <TweakRadio
          label="Sidebar"
          value={t.sidebar}
          options={[
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
          ]}
          onChange={(v) => setTweak('sidebar', v)}
        />

        <TweakSection label="Layout" />
        <TweakRadio
          label="Roundness"
          value={t.radius}
          options={[
            { value: 'square', label: 'Subtle' },
            { value: 'round', label: 'Soft' },
            { value: 'extra', label: 'Pillowy' },
          ]}
          onChange={(v) => setTweak('radius', v)}
        />
        <TweakRadio
          label="Density"
          value={t.density}
          options={[
            { value: 'compact', label: 'Compact' },
            { value: 'regular', label: 'Regular' },
            { value: 'comfy', label: 'Comfy' },
          ]}
          onChange={(v) => setTweak('density', v)}
        />

        <TweakSection label="Identity" />
        <TweakText
          label="Name"
          value={t.userName}
          placeholder={nameFromEmail(me?.email) || 'from login'}
          onChange={(v) => setTweak('userName', v)}
        />
      </TweaksPanel>
    </div>
  );
}
