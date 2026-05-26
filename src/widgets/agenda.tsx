// agenda — static daily schedule (yml-driven, no backend).
//
//   - type: agenda
//     config: { source: schedule.yml }

import { useEffect, useState } from 'react';
import yaml from 'js-yaml';
import { Panel } from './Panel';
import { registerWidget } from './registry';
import { mockHint } from './mockHint';
import type { AgendaItem, WidgetProps } from '../types';
import './agenda.css';

const AGENDA_MOCK: AgendaItem[] = [
  { time: '10:00 AM', title: 'Design Review', meta: 'Meeting', kind: 'work' },
  { time: '11:30 AM', title: 'Project Sync', meta: 'Meeting', kind: 'work' },
  { time: '2:00 PM', title: 'Deep Work', meta: 'Focus Time', kind: 'focus' },
];

// useFetch is JSON-only; agenda's source is YAML, so load it directly.
function AgendaWidget({ config }: WidgetProps) {
  const src = config?.source as string | undefined;
  const [data, setData] = useState<{ items?: AgendaItem[] } | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!src) {
      setData(null);
      return;
    }
    let cancelled = false;
    fetch(src)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((txt) => {
        if (!cancelled) setData(yaml.load(txt) as { items?: AgendaItem[] });
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  const items = data?.items ?? AGENDA_MOCK;
  const showingMock = error || !data;

  return (
    <Panel
      title="Today's Agenda"
      hint={mockHint({ error: showingMock ? error : null, reason: 'no schedule.yml' })}
      footer={
        <>
          <span>View Full Calendar</span>
          <img className="arr" src="icons/arrow-right.svg" alt="" />
        </>
      }
    >
      <div className="agenda">
        {items.map((a, i) => (
          <div key={i} className="agenda-item">
            <div className="agenda-time">{a.time}</div>
            <div className={`agenda-dot ${a.kind || ''}`} />
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
