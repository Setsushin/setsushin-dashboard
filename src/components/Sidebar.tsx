// Sidebar — brand, nav (hash routes), Quick Capture.

import { focusTaskInput } from '../lib/events';
import type { PageDef } from '../pages';

export interface SidebarProps {
  brand: string;
  pages: PageDef[];
  activeId?: string;
  open: boolean;
  onClose?: () => void;
}

export function Sidebar({ brand, pages, activeId, open, onClose }: SidebarProps) {
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
          {pages.map((p) => (
            <button
              key={p.id}
              className={`sb-item ${p.id === activeId ? 'is-active' : ''}`}
              onClick={() => onClick(p.id)}
            >
              <img className="ico" src={p.icon} alt="" />
              <span>{p.label}</span>
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
