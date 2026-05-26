// App — root composition. Pulls the shell + grid/edit + widgets + tweaks panel
// together. main.tsx mounts it.

import { useCallback, useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { PageHeader } from './components/PageHeader';
import { StatStrip } from './components/Stat';
import { HeaderStrip } from './components/HeaderStrip';
import { DashboardGrid } from './components/DashboardGrid';
import { PageMetaModal, type PageMetaForm, type PageMetaInitial } from './components/PageMetaModal';
import { TweaksPanel, TweakSection, TweakRadio, TweakColor, TweakText } from './components/tweaks';
import { EditableGrid } from './edit/EditableGrid';
import { TaskFormModal } from './widgets/TaskFormModal';
import { ToastHost } from './components/Toast';
import { useLayout } from './hooks/useLayout';
import { useHashRoute } from './hooks/useHashRoute';
import { useTweaks } from './hooks/useTweaks';
import { onFocusTaskInput, onOpenTaskModal, showToast } from './lib/events';
import { apiFetch } from './lib/api';
import { hexToSoft } from './lib/color';
import type { GridItem, Me, Task } from './types';

interface Tweaks {
  tone: string;
  accent: string;
  radius: string;
  density: string;
  sidebar: string;
  mode: string;
  userName: string;
}

const TWEAK_DEFAULTS: Tweaks = /*EDITMODE-BEGIN*/ {
  tone: 'warm',
  accent: '#d97757',
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
type PageMetaModalState = { mode: 'add' | 'edit'; initial: PageMetaInitial | null } | null;

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

  const {
    loading: layoutLoading,
    layout,
    error: layoutError,
    reloadOverrides,
    setOverrideLocal,
    reloadPagesMeta,
    setPageMetaLocal,
  } = useLayout();

  const [editMode, setEditMode] = useState(false);
  // Mobile-only sidebar drawer (CSS hides it >768px).
  const [navOpen, setNavOpen] = useState(false);
  const [pageMetaModal, setPageMetaModal] = useState<PageMetaModalState>(null);
  // Single global task modal: null | 'add' | <task>.
  const [taskModal, setTaskModal] = useState<TaskModalState>(null);
  const closeTaskModal = useCallback(() => setTaskModal(null), []);

  useEffect(() => {
    const offFocus = onFocusTaskInput(() => setTaskModal((prev) => prev ?? 'add'));
    const offOpen = onOpenTaskModal((task?: Task) => setTaskModal(task || 'add'));
    const onKey = (e: KeyboardEvent) => {
      if (taskModal !== null || pageMetaModal !== null) return;
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
  }, [taskModal, pageMetaModal]);

  useEffect(() => {
    document.body.dataset.tone = t.tone;
    document.body.dataset.density = t.density;
    document.body.dataset.sidebar = t.sidebar;
    document.body.dataset.radius = t.radius;
    document.body.dataset.mode = t.mode;
    document.documentElement.style.setProperty('--accent', t.accent);
    document.documentElement.style.setProperty('--accent-soft', hexToSoft(t.accent));
  }, [t]);

  useEffect(() => {
    if (layout?.brand) document.title = `${displayName || layout.brand} · Dashboard`;
  }, [layout, displayName]);

  const today = new Date();
  const month = today.toLocaleDateString('en-US', { month: 'short' });
  const day = String(today.getDate()).padStart(2, '0');
  const year = today.getFullYear();
  const dateStr = `${month} · ${day} · ${year}`;
  const weekday = today.toLocaleDateString('en-US', { weekday: 'short' });

  const hash = useHashRoute();

  // Switching pages while editing exits edit mode (drops the draft) and closes
  // the mobile nav drawer.
  useEffect(() => {
    setEditMode(false);
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

  if (layoutLoading) return <div className="boot">Loading layout…</div>;
  if (layoutError || !layout)
    return <div className="boot boot-err">Failed to load layout.yml: {String(layoutError?.message)}</div>;

  const pages = layout.pages || [];
  const pageIds = new Set(pages.map((p) => p.id));
  const page = pages.find((p) => p.id === hash) || pages[0];

  const onSaveLayout = async (grid: GridItem[]) => {
    if (!page) return;
    setOverrideLocal(page.id, grid);
    try {
      await apiFetch('/api/layout', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ page_id: page.id, grid }),
      });
      setEditMode(false);
    } catch (err) {
      console.error('layout save failed:', err);
      showToast(`Save failed: ${(err as Error).message} — changes kept in the editor`, 'error');
      reloadOverrides();
    }
  };

  const onSavePageMeta = async (form: PageMetaForm) => {
    const isAdd = pageMetaModal?.mode === 'add';
    setPageMetaLocal(form.page_id, {
      label: form.label,
      icon: form.icon,
      title: form.title,
      subtitle: form.subtitle,
    });
    setPageMetaModal(null);
    try {
      await apiFetch(`/api/pages/${encodeURIComponent(form.page_id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      reloadPagesMeta();
      if (isAdd) window.location.hash = form.page_id;
    } catch (err) {
      console.error('page meta save failed:', err);
      showToast(`Save failed: ${(err as Error).message}`, 'error');
      reloadPagesMeta();
    }
  };

  const onDeletePage = async (pageId: string) => {
    if (!window.confirm(`Delete page "${pageId}" and its layout? This cannot be undone.`)) return;
    setPageMetaLocal(pageId, null);
    setOverrideLocal(pageId, null);
    setPageMetaModal(null);
    try {
      await apiFetch(`/api/pages/${encodeURIComponent(pageId)}`, { method: 'DELETE' });
      reloadPagesMeta();
      reloadOverrides();
      if (window.location.hash.slice(1) === pageId) window.location.hash = '';
    } catch (err) {
      console.error('page delete failed:', err);
      showToast(`Delete failed: ${(err as Error).message}`, 'error');
      reloadPagesMeta();
      reloadOverrides();
    }
  };

  const onResetPage = async () => {
    if (!page) return;
    if (!window.confirm(`Reset "${page.id}" to layout.yml default?`)) return;
    try {
      await apiFetch(`/api/layout?page_id=${encodeURIComponent(page.id)}`, { method: 'DELETE' });
      setOverrideLocal(page.id, null);
      setEditMode(false);
    } catch (err) {
      console.error('layout reset failed:', err);
      showToast(`Reset failed: ${(err as Error).message}`, 'error');
    }
  };

  return (
    <div className="app">
      <Sidebar
        brand={displayName}
        nav={layout.nav}
        activeId={page?.id}
        pageIds={pageIds}
        onAddPage={() => setPageMetaModal({ mode: 'add', initial: null })}
        open={navOpen}
        onClose={() => setNavOpen(false)}
      />
      <main className="main">
        <TopBar
          mode={t.mode}
          onToggleMode={() => {
            const nextMode = t.mode === 'dark' ? 'light' : 'dark';
            setTweak({ mode: nextMode, sidebar: nextMode });
          }}
          editMode={editMode}
          onToggleEditMode={() => setEditMode((v) => !v)}
          onMenuClick={() => setNavOpen(true)}
          me={me}
        />
        <div className="content" data-screen-label={page?.id} data-edit-mode={editMode || undefined}>
          <PageHeader name={displayName} dateStr={dateStr} weekday={weekday} title={page?.title} subtitle={page?.subtitle} />
          <StatStrip stats={page?.stats} />
          <HeaderStrip items={page?.header} />
          {editMode && page ? (
            <EditableGrid
              page={page}
              onSave={onSaveLayout}
              onCancel={() => setEditMode(false)}
              onResetPage={onResetPage}
              onEditPageMeta={() =>
                setPageMetaModal({
                  mode: 'edit',
                  initial: {
                    page_id: page.id,
                    label: layout.nav.find((n) => n.id === page.id)?.label || '',
                    icon: layout.nav.find((n) => n.id === page.id)?.icon || 'icons/more.svg',
                    title: page.title || '',
                    subtitle: page.subtitle || '',
                    userAdded: !!page.userAdded,
                  },
                })
              }
            />
          ) : (
            <DashboardGrid items={page?.grid} />
          )}
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
          existingIds={pages.map((p) => p.id)}
          onSave={onSavePageMeta}
          onDelete={
            pageMetaModal.mode === 'edit' && pageMetaModal.initial?.page_id
              ? () => onDeletePage(pageMetaModal.initial!.page_id!)
              : undefined
          }
          onClose={() => setPageMetaModal(null)}
        />
      )}

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
        <TweakRadio
          label="Tone"
          value={t.tone}
          options={[
            { value: 'warm', label: 'Warm' },
            { value: 'sage', label: 'Sage' },
            { value: 'cool', label: 'Cool' },
            { value: 'lavender', label: 'Lilac' },
          ]}
          onChange={(v) => {
            const accentByTone: Record<string, string> = {
              warm: '#d97757',
              sage: '#6f8e5a',
              cool: '#5b6cff',
              lavender: '#9a72c4',
            };
            setTweak({ tone: v, accent: accentByTone[v] });
          }}
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
