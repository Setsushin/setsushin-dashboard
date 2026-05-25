// UserMenu — top-right avatar + email + logout popover. Reads identity (`me`)
// as a prop from App so /api/me is fetched once.

import { useEffect, useRef, useState } from 'react';
import type { Me } from '../types';

async function gravatarHash(email: string): Promise<string> {
  const buf = new TextEncoder().encode(email.trim().toLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function UserMenu({ me }: { me: Me | null }) {
  const [open, setOpen] = useState(false);
  const [hash, setHash] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const email = me?.email;

  useEffect(() => {
    if (!email) return;
    gravatarHash(email).then(setHash).catch(() => setHash(null));
  }, [email]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const initial = email ? email[0].toUpperCase() : 'S';
  const avatarUrl = hash ? `https://www.gravatar.com/avatar/${hash}?s=76&d=identicon` : null;

  return (
    <div className="user-menu" ref={wrapRef}>
      <button
        className="avatar-btn"
        aria-label="Account"
        aria-expanded={open ? 'true' : 'false'}
        onClick={() => setOpen((o) => !o)}
      >
        {initial}
        {avatarUrl && (
          <img
            key={avatarUrl}
            className="avatar-img"
            src={avatarUrl}
            alt=""
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        )}
      </button>
      {open && (
        <div className="user-pop" role="menu">
          <div className="user-pop-email" title={email || ''}>
            {email || '—'}
          </div>
          {me?.local ? (
            <div className="user-pop-note">local dev · no logout</div>
          ) : (
            <a
              className="user-pop-logout"
              role="menuitem"
              href={`/cdn-cgi/access/logout?returnTo=${encodeURIComponent(window.location.origin + '/')}`}
              onClick={(e) => {
                if (!window.confirm('Log out of the dashboard?')) e.preventDefault();
              }}
            >
              Log out
            </a>
          )}
        </div>
      )}
    </div>
  );
}
