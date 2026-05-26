// calendar — live Google Calendar (or any ICS) feed via /api/calendar.
//
//   - type: calendar
//     config: { endpoint: /api/calendar, source: primary, limit: 8 }

import { useEffect, useState } from 'react';
import { Panel } from './Panel';
import { registerWidget, useWidgetSize } from './registry';
import { useFetch } from '../hooks/useFetch';
import type { CalEvent, CalendarSource, WidgetProps } from '../types';
import './agenda.css';

function nowOffsetISO(hoursFromNow: number): string {
  return new Date(Date.now() + hoursFromNow * 3600_000).toISOString();
}

const CALENDAR_MOCK: CalEvent[] = [
  { title: 'Design Review', start: nowOffsetISO(1.5), location: 'Zoom', allDay: false, end: null },
  { title: 'Project Sync', start: nowOffsetISO(4.0), location: 'Office', allDay: false, end: null },
  { title: 'Deep Work', start: nowOffsetISO(6.5), location: '', allDay: false, end: null },
  { title: 'Gym', start: nowOffsetISO(9.0), location: 'Anytime', allDay: false, end: null },
];

// Pick a default source set. Precedence: localStorage → config.sources →
// config.source → ['primary']. Reconciled against /api/calendar/sources.
function initialSelected(config: WidgetProps['config']): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem('calendar-sources') || 'null') as unknown;
    if (Array.isArray(stored) && stored.length > 0) return stored as string[];
  } catch {
    /* ignore */
  }
  const sources = config?.sources as string[] | undefined;
  if (Array.isArray(sources) && sources.length > 0) return sources;
  const source = config?.source as string | undefined;
  if (source) return [source];
  return ['primary'];
}

function CalendarWidget({ config }: WidgetProps) {
  const size = useWidgetSize();
  const endpoint = (config?.endpoint as string) || '/api/calendar';
  const limit = (config?.limit as number) ?? (size === 'compact' ? 3 : 8);

  const { data: available } = useFetch<CalendarSource[]>(`${endpoint}/sources`, {
    ttl: 60 * 60_000,
    fallback: [],
  });

  const [selected, setSelected] = useState<string[]>(() => initialSelected(config));

  // Reconcile against the server's catalog once it loads. Drop keys no longer
  // bound; if nothing valid remains, fall back to the first available source.
  useEffect(() => {
    if (!Array.isArray(available) || available.length === 0) return;
    const valid = new Set(available.map((s) => s.key));
    setSelected((prev) => {
      const cleaned = prev.filter((k) => valid.has(k));
      if (cleaned.length === prev.length) return prev;
      const next = cleaned.length > 0 ? cleaned : [available[0].key];
      try {
        localStorage.setItem('calendar-sources', JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [available]);

  const toggleSource = (key: string) => {
    setSelected((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      // Always keep at least one source on, else /api/calendar 400s → mock mode.
      const final = next.length === 0 ? prev : next;
      try {
        localStorage.setItem('calendar-sources', JSON.stringify(final));
      } catch {
        /* ignore */
      }
      return final;
    });
  };

  const url = `${endpoint}?sources=${encodeURIComponent(selected.join(','))}&limit=${limit}`;
  const { data, loading, error } = useFetch<CalEvent[] | { error: string }>(url, {
    ttl: 10 * 60_000,
    fallback: CALENDAR_MOCK,
  });

  const isErrorObj = data != null && !Array.isArray(data) && 'error' in data;
  const events: CalEvent[] = Array.isArray(data) ? data : CALENDAR_MOCK;
  const showingMock = error || isErrorObj || !data;
  const errMsg = isErrorObj ? data.error : error ? String(error.message) : null;

  const showChips = Array.isArray(available) && available.length >= 2;
  const action = <span className="muted" style={{ fontSize: 11 }}>{events.length} upcoming</span>;

  return (
    <Panel title="Calendar" hint={showingMock ? `(mock — ${errMsg || 'unreachable'})` : null} action={action}>
      {showChips && (
        <div className="cal-sources">
          {available.map((s) => (
            <button
              key={s.key}
              className={`cal-source-chip ${selected.includes(s.key) ? 'is-active' : ''}`}
              onClick={() => toggleSource(s.key)}
              title={`Toggle ${s.label} calendar`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      <div className="agenda">
        {events.map((e, i) => (
          <div key={i} className="agenda-item">
            <div className="agenda-time">{formatEventTime(e)}</div>
            <div className={`agenda-dot ${e.source ? `src-${e.source}` : 'work'}`} />
            <div className="agenda-content">
              <div className="agenda-title">{e.title}</div>
              <div className="agenda-meta">{e.location || (e.allDay ? 'All day' : '')}</div>
            </div>
          </div>
        ))}
        {loading && events.length === 0 && <div className="muted" style={{ padding: 12 }}>Loading…</div>}
        {!loading && events.length === 0 && <div className="muted" style={{ padding: 12 }}>Nothing upcoming.</div>}
      </div>
    </Panel>
  );
}

function formatEventTime(e: CalEvent): string {
  const d = new Date(e.start);
  if (isNaN(d.getTime())) return '';
  if (e.allDay) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return time;
  const day = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${day} ${time}`;
}

registerWidget('calendar', CalendarWidget);
