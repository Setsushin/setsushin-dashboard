// widgets/agenda.jsx — static daily schedule (yml-driven, no backend)
//
// Config (in layout.yml):
//   - type: agenda
//     config:
//       source: schedule.yml
//
// schedule.yml shape:
//   items:
//     - { time: "10:00 AM", title: "Design Review", meta: "Meeting", kind: work }
//     - ...

const AGENDA_MOCK = [
  { time: '10:00 AM', title: 'Design Review', meta: 'Meeting', kind: 'work' },
  { time: '11:30 AM', title: 'Project Sync', meta: 'Meeting', kind: 'work' },
  { time: '2:00 PM',  title: 'Deep Work', meta: 'Focus Time', kind: 'focus' },
];

// useFetch is JSON-only; agenda's source is YAML, so load it directly.
function AgendaWidget({ config }) {
  const src = config?.source;
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (!src) { setData(null); return; }
    let cancelled = false;
    fetch(src)
      .then(r => r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(txt => { if (!cancelled) setData(jsyaml.load(txt)); })
      .catch(err => { if (!cancelled) setError(err); });
    return () => { cancelled = true; };
  }, [src]);

  const items = data?.items ?? AGENDA_MOCK;
  const showingMock = error || !data;

  return (
    <Panel
      title="Today's Agenda"
      hint={mockHint({ error: showingMock ? error : null, reason: 'no schedule.yml' })}
      footer={<><span>View Full Calendar</span><img className="arr" src="icons/arrow-right.svg" alt="" /></>}
    >
      <div className="agenda">
        {items.map((a, i) => (
          <div key={i} className="agenda-item">
            <div className="agenda-time">{a.time}</div>
            <div className={`agenda-dot ${a.kind || ''}`}></div>
            <div className="agenda-content">
              <div className="agenda-title">{a.title}</div>
              <div className="agenda-meta">{a.meta}</div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

registerWidget('agenda', AgendaWidget);
