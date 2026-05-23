// widgets/calendar.jsx — live Google Calendar (or any ICS) feed
//
// Config (in layout.yml):
//   - type: calendar
//     config:
//       endpoint: /api/calendar
//       source: primary       # maps to env var CALENDAR_PRIMARY_ICS
//       limit: 8
//
// Set the ICS URL via env:
//   - dev: wrangler.toml [vars] CALENDAR_PRIMARY_ICS = "https://..."
//   - prod: CF Pages dashboard → Settings → Environment variables

const CALENDAR_MOCK = [
  { title: 'Design Review',  start: nowOffsetISO( 1.5), location: 'Zoom',     allDay: false },
  { title: 'Project Sync',   start: nowOffsetISO( 4.0), location: 'Office',   allDay: false },
  { title: 'Deep Work',      start: nowOffsetISO( 6.5), location: '',         allDay: false },
  { title: 'Gym',            start: nowOffsetISO( 9.0), location: 'Anytime',  allDay: false },
];

function nowOffsetISO(hoursFromNow) {
  return new Date(Date.now() + hoursFromNow * 3600_000).toISOString();
}

// Pick a default source set. Order of precedence:
//   1. localStorage 'calendar-sources' (user's runtime selection)
//   2. layout.yml config.sources (array)
//   3. layout.yml config.source (single, legacy)
//   4. ['primary']
// The selection is reconciled against /api/calendar/sources once it loads
// (see useEffect inside CalendarWidget): keys the server no longer binds
// are dropped so a removed CALENDAR_<KEY>_ICS env var can't strand the
// widget on a 400.
function initialSelected(config) {
  try {
    const stored = JSON.parse(localStorage.getItem('calendar-sources') || 'null');
    if (Array.isArray(stored) && stored.length > 0) return stored;
  } catch {}
  if (Array.isArray(config?.sources) && config.sources.length > 0) return config.sources;
  if (config?.source) return [config.source];
  return ['primary'];
}

function CalendarWidget({ config }) {
  const size = useWidgetSize();
  const endpoint = config?.endpoint || '/api/calendar';
  const limit = config?.limit ?? (size === 'compact' ? 3 : 8);

  // Catalog of bound CALENDAR_*_ICS env vars (no URLs leaked, just keys).
  const { data: available } = useFetch(`${endpoint}/sources`, {
    ttl: 60 * 60_000,
    fallback: [],
  });

  const [selected, setSelected] = React.useState(() => initialSelected(config));

  // Reconcile against the server's catalog once it loads. Drop keys that
  // are no longer bound; if nothing valid remains, fall back to the first
  // available source. Skips while `available` is still empty (initial
  // fallback or genuinely 0 sources — in the latter case the request will
  // 400 regardless and we have nothing meaningful to snap to).
  React.useEffect(() => {
    if (!Array.isArray(available) || available.length === 0) return;
    const valid = new Set(available.map(s => s.key));
    setSelected(prev => {
      const cleaned = prev.filter(k => valid.has(k));
      if (cleaned.length === prev.length) return prev;
      const next = cleaned.length > 0 ? cleaned : [available[0].key];
      try { localStorage.setItem('calendar-sources', JSON.stringify(next)); } catch {}
      return next;
    });
  }, [available]);

  const toggleSource = (key) => {
    setSelected(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      // Disallow empty selection — always keep at least one source on, otherwise
      // /api/calendar?sources= would 400 and the widget falls into mock mode.
      const final = next.length === 0 ? prev : next;
      try { localStorage.setItem('calendar-sources', JSON.stringify(final)); } catch {}
      return final;
    });
  };

  const url = `${endpoint}?sources=${encodeURIComponent(selected.join(','))}&limit=${limit}`;
  const { data, loading, error } = useFetch(url, {
    ttl: 10 * 60_000,
    fallback: CALENDAR_MOCK,
  });

  const isErrorObj = data && !Array.isArray(data) && data.error;
  const events = Array.isArray(data) ? data : CALENDAR_MOCK;
  const showingMock = error || isErrorObj || !data;
  const errMsg = isErrorObj ? data.error : (error ? String(error.message) : null);

  // Only show the chip strip when there's an actual choice to make.
  const showChips = Array.isArray(available) && available.length >= 2;
  const action = <span className="muted" style={{fontSize: 11}}>{events.length} upcoming</span>;

  return (
    <Panel
      title="Calendar"
      hint={showingMock ? `(mock — ${errMsg || 'unreachable'})` : null}
      action={action}
    >
      {showChips && (
        <div className="cal-sources">
          {available.map(s => (
            <button key={s.key}
                    className={`cal-source-chip ${selected.includes(s.key) ? 'is-active' : ''}`}
                    onClick={() => toggleSource(s.key)}
                    title={`Toggle ${s.label} calendar`}>
              {s.label}
            </button>
          ))}
        </div>
      )}
      <div className="agenda">
        {events.map((e, i) => (
          <div key={i} className="agenda-item">
            <div className="agenda-time">{formatEventTime(e)}</div>
            <div className={`agenda-dot ${e.source ? `src-${e.source}` : 'work'}`}></div>
            <div className="agenda-content">
              <div className="agenda-title">{e.title}</div>
              <div className="agenda-meta">{e.location || (e.allDay ? 'All day' : '')}</div>
            </div>
          </div>
        ))}
        {loading && events.length === 0 && <div className="muted" style={{padding: 12}}>Loading…</div>}
        {!loading && events.length === 0 && <div className="muted" style={{padding: 12}}>Nothing upcoming.</div>}
      </div>
    </Panel>
  );
}

function formatEventTime(e) {
  const d = new Date(e.start);
  if (isNaN(d)) return '';
  if (e.allDay) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  // Today → just time; otherwise day + time
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return time;
  const day = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${day} ${time}`;
}

registerWidget('calendar', CalendarWidget);
