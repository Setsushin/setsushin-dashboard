// TopBar — search, theme toggle, edit-mode toggle, notifications, user menu.

import { useEffect, useRef } from 'react';
import { UserMenu } from './UserMenu';
import type { Me } from '../types';

export interface TopBarProps {
  mode: string;
  onToggleMode: () => void;
  editMode: boolean;
  onToggleEditMode: () => void;
  onMenuClick: () => void;
  me: Me | null;
}

export function TopBar({ mode, onToggleMode, editMode, onToggleEditMode, onMenuClick, me }: TopBarProps) {
  const isDark = mode === 'dark';
  const searchRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K focuses search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" aria-label="Open navigation" onClick={onMenuClick}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <div className="search">
        <img className="search-ico" src="icons/search.svg" alt="" />
        <input ref={searchRef} placeholder="Search anything..." />
        <span className="search-kbd">⌘K</span>
      </div>
      <button
        className="icon-btn"
        aria-label="Toggle theme"
        onClick={onToggleMode}
        title={isDark ? 'Switch to light' : 'Switch to dark'}
      >
        {isDark ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        )}
      </button>
      <button
        className={`icon-btn ${editMode ? 'is-active' : ''}`}
        aria-label="Toggle edit mode"
        onClick={onToggleEditMode}
        title={editMode ? 'Exit edit mode' : 'Edit layout (drag, resize, add, remove)'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
      <button className="icon-btn" aria-label="Notifications">
        <img src="icons/bell.svg" alt="" />
        <span className="dot" />
      </button>
      <UserMenu me={me} />
    </header>
  );
}
