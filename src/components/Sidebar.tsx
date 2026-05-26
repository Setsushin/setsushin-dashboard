// Sidebar — brand, nav, Quick Capture. nav.id matching a page.id routes via
// the URL hash; otherwise it scrolls to a widget with that id (legacy mode).

import { focusTaskInput } from '../lib/events';
import type { NavItem } from '../types';

export interface SidebarProps {
  brand: string;
  nav: NavItem[];
  activeId?: string;
  pageIds: Set<string>;
  onAddPage?: () => void;
  open: boolean;
  onClose?: () => void;
}

export function Sidebar({ brand, nav, activeId, pageIds, onAddPage, open, onClose }: SidebarProps) {
  const onClick = (id: string) => {
    if (pageIds.has(id)) {
      window.location.hash = id;
    } else {
      const el = document.querySelector(`#widget-${id}-0`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    onClose?.();
  };
  const dataOpen = open ? 'true' : undefined;
  return (
    <>
      <div className="sidebar-backdrop" data-open={dataOpen} onClick={onClose} />
      <aside className="sidebar" data-open={dataOpen}>
        <div className="sb-brand">
          <div className="sb-brand-mark">{brand && brand[0] ? brand[0].toUpperCase() : 'S'}</div>
          <div className="sb-brand-name">{brand}</div>
        </div>
        <nav className="sb-nav">
          {(nav ?? []).map((n) => (
            <button
              key={n.id}
              className={`sb-item ${n.id === activeId ? 'is-active' : ''}`}
              onClick={() => onClick(n.id)}
            >
              <img className="ico" src={n.icon} alt="" />
              <span>{n.label}</span>
              {n.badge && <span className="badge">{n.badge}</span>}
            </button>
          ))}
          {onAddPage && (
            <button
              className="sb-item sb-add-page"
              onClick={() => {
                onAddPage();
                onClose?.();
              }}
              title="Create a new page (label, icon, title, subtitle)"
            >
              <span className="sb-add-plus">+</span>
              <span>Add page</span>
            </button>
          )}
        </nav>
        <div
          className="sb-quick-capture"
          onClick={() => {
            focusTaskInput();
            onClose?.();
          }}
          style={{ cursor: 'pointer' }}
          title="Jump to Add task input"
        >
          <img className="ico" src="icons/add.svg" alt="" style={{ width: 14, height: 14 }} />
          <span>Quick Capture</span>
          <span className="kbd">N</span>
        </div>
      </aside>
    </>
  );
}
