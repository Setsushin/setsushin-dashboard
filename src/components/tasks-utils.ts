// Shared helpers for the tasks widget + its form modal.

export const TAG_PRESETS = ['Personal', 'Work'];

export function deriveKind(tag: string | null | undefined): 'work' | 'personal' {
  return (tag || '').trim().toLowerCase() === 'work' ? 'work' : 'personal';
}

// "Apr 6" when time is exactly 00:00, "Apr 6 18:30" otherwise.
export function fmtDue(unixSec: number | null | undefined): string {
  if (!unixSec) return '';
  const d = new Date(unixSec * 1000);
  const month = d.toLocaleString('en-US', { month: 'short' });
  const day = d.getDate();
  const hh = d.getHours();
  const mm = d.getMinutes();
  if (hh === 0 && mm === 0) return `${month} ${day}`;
  return `${month} ${day} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function dueAtToLocalInput(unixSec: number | null | undefined): string {
  if (!unixSec) return '';
  const d = new Date(unixSec * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function localInputToDueAt(s: string): number | null {
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
}
