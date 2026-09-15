// Sidebar — brand, nav (hash routes), Quick Capture.

import { focusTaskInput } from '../lib/events';
import type { NavItem } from '../types';

export interface SidebarProps {
  brand: string;
  nav: NavItem[];
  activeId?: string;
  open: boolean;
  onClose?: () => void;
}

export function Sidebar({ brand, nav, activeId, open, onClose }: SidebarProps) {
  const onClick = (id: string) => {
    window.location.hash = id;
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
