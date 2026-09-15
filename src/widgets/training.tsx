// training — upper/lower split workout card. Plan text comes from a yaml file
// (config.source, loaded like agenda's schedule.yml); weights + per-JST-day set
// ticks live in D1 via /api/training — one JSON doc per key (`weights`,
// `log:YYYY-MM-DD`). Both days render side by side; under 900px one column
// with a day switch (CSS).
//
//   - type: training
//     config: { source: training.yml }

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import yaml from 'js-yaml';
import { Panel } from './Panel';
import { registerWidget } from './registry';
import { mockHint } from './mockHint';
import { apiFetch } from '../lib/api';
import { showToast } from '../lib/events';
import { renderMarkdown } from '../lib/markdown';
import type { WidgetProps } from '../types';
import './training.css';

interface Exercise {
  id: string;
  name: string;
  scheme: string;
  load?: string;
  kg?: number | null;
  unit?: string;
  cue?: string;
  prog?: string;
}
type Item =
  | (Exercise & { type: 'single'; sets: number })
  | { type: 'superset'; id: string; label: string; rounds: number; rest: string; exercises: Exercise[] }
  | { type: 'cardio'; id: string; name: string; scheme: string; cue?: string };
interface Day {
  name: string;
  sub?: string;
  items: Item[];
}
interface Plan {
  days: Record<string, Day>;
  rules?: string;
}

type Weights = Record<string, number | null>;
type Ticks = Record<string, boolean[]>;
interface LogDoc {
  day: string;
  ticks: Ticks;
}
type Docs = Record<string, unknown>;

const JSON_HEADERS = { 'content-type': 'application/json' };

// ponytail: JST (+9h) hardcoded — single-user dashboard, user lives in JP.
const todayKey = () => 'log:' + new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

const tickCount = (it: Item) => (it.type === 'superset' ? it.rounds : it.type === 'cardio' ? 1 : it.sets);

function Load({ ex, kg, editing, onSet }: { ex: Exercise; kg: number | null; editing: boolean; onSet: (v: number | null) => void }) {
  if (ex.load) {
    return (
      <>
        <span className="tr-kg tr-kg-text">{ex.load}</span>
        <span className="tr-scheme">{ex.scheme}</span>
      </>
    );
  }
  return (
    <>
      {editing ? (
        <input
          key={String(kg)}
          className="tr-kgin"
          type="number"
          inputMode="decimal"
          step="0.5"
          defaultValue={kg ?? ''}
          aria-label={`${ex.name} weight`}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          onBlur={(e) => {
            const v = e.target.value === '' ? null : Number(e.target.value);
            if (v !== kg && !Number.isNaN(v ?? 0)) onSet(v);
          }}
        />
      ) : (
        <span className="tr-kg">{kg ?? '—'}</span>
      )}
      <span className="tr-unit">{ex.unit || 'kg'}</span>
      <span className="tr-scheme">× {ex.scheme}</span>
    </>
  );
}

function ExerciseBlock({ ex, weights, editing, onSet }: { ex: Exercise; weights: Weights; editing: boolean; onSet: (id: string, v: number | null) => void }) {
  const kg = weights[ex.id] ?? ex.kg ?? null;
  return (
    <div className="tr-ex">
      <h4 className="tr-name">{ex.name}</h4>
      <div className="tr-load">
        <Load ex={ex} kg={kg} editing={editing} onSet={(v) => onSet(ex.id, v)} />
      </div>
      {ex.cue && <p className="tr-cue">{ex.cue}</p>}
      {ex.prog && <p className="tr-prog">{ex.prog}</p>}
    </div>
  );
}

function TickRow({ n, arr, label, onToggle }: { n: number; arr?: boolean[]; label: (i: number) => string; onToggle: (i: number) => void }) {
  return (
    <div className="tr-ticks" role="group" aria-label="Sets done">
      {Array.from({ length: n }, (_, i) => (
        <button key={i} type="button" className="tr-tick" aria-pressed={!!arr?.[i]} onClick={() => onToggle(i)}>
          {label(i)}
        </button>
      ))}
    </div>
  );
}

function TrainingWidget({ config }: WidgetProps) {
  const src = config?.source as string | undefined;
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planError, setPlanError] = useState<Error | null>(null);
  const [docs, setDocs] = useState<Docs>({});
  const [editing, setEditing] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (!src) {
      setPlanError(new Error('no source'));
      return;
    }
    let cancelled = false;
    fetch(src)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((txt) => {
        if (!cancelled) setPlan(yaml.load(txt) as Plan);
      })
      .catch((err: Error) => {
        if (!cancelled) setPlanError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  const reload = useCallback(() => {
    return fetch('/api/training')
      .then((r) => (r.ok ? (r.json() as Promise<Docs>) : {}))
      .then(setDocs)
      .catch(() => setDocs({}));
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  const rulesHtml = useMemo(() => (plan?.rules ? renderMarkdown(plan.rules) : ''), [plan?.rules]);

  // Optimistic-first: apply locally, PUT, and on failure toast + reload.
  // PUTs are chained so two quick ticks can't land on the server out of order.
  const queue = useRef(Promise.resolve());
  const save = (key: string, data: unknown) => {
    setDocs((d) => ({ ...d, [key]: data }));
    queue.current = queue.current
      .then(() => apiFetch('/api/training', { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ key, data }) }))
      .then(
        () => undefined,
        (err: Error) => {
          showToast(`${err.message} — reverted`, 'error');
          void reload();
        },
      );
  };

  const today = todayKey();
  const weights = (docs.weights ?? {}) as Weights;
  const log = docs[today] as LogDoc | undefined;
  const ticks = log?.ticks ?? {};
  const dayKeys = plan ? Object.keys(plan.days) : [];

  // Mobile default day: today's session if one is logged, else the day after
  // the most recent log (missed session → next in sequence), else the first.
  const logKeys = Object.keys(docs)
    .filter((k) => k.startsWith('log:'))
    .sort();
  const lastKey = logKeys[logKeys.length - 1];
  const lastDay = lastKey ? (docs[lastKey] as LogDoc | undefined)?.day : undefined;
  const defaultDay = !lastDay
    ? dayKeys[0]
    : lastKey === today
      ? lastDay
      : dayKeys[(dayKeys.indexOf(lastDay) + 1) % dayKeys.length];
  const shown = active ?? defaultDay;

  const toggleTick = (day: string, id: string, n: number, i: number) => {
    const arr = Array.from({ length: n }, (_, j) => ticks[id]?.[j] ?? false);
    arr[i] = !arr[i];
    save(today, { day, ticks: { ...ticks, [id]: arr } });
  };
  const clearDay = (day: string) => {
    if (!log || !plan) return;
    const ids = new Set(plan.days[day].items.map((it) => it.id));
    const rest = Object.fromEntries(Object.entries(ticks).filter(([id]) => !ids.has(id)));
    save(today, { day: log.day, ticks: rest });
  };
  const setWeight = (id: string, v: number | null) => save('weights', { ...weights, [id]: v });

  if (!plan) {
    return (
      <Panel title="Training" className="panel-wide" hint={mockHint({ error: planError })}>
        <div className="tr-empty">{planError ? `Could not load ${src ?? 'plan'}` : 'Loading…'}</div>
      </Panel>
    );
  }

  const action = (
    <button type="button" className="panel-action tr-edit" aria-pressed={editing} onClick={() => setEditing((v) => !v)}>
      {editing ? 'Done' : 'Edit weights'}
    </button>
  );

  return (
    <Panel title="Training" className="panel-wide" action={action}>
      <div className="tr-switch" role="group" aria-label="Day">
        {dayKeys.map((k) => (
          <button key={k} type="button" aria-pressed={shown === k} onClick={() => setActive(k)}>
            {plan.days[k].name}
          </button>
        ))}
      </div>
      <div className="tr-days">
        {dayKeys.map((k) => {
          const day = plan.days[k];
          const total = day.items.reduce((s, it) => s + tickCount(it), 0);
          const done = day.items.reduce((s, it) => s + (ticks[it.id] ?? []).slice(0, tickCount(it)).filter(Boolean).length, 0);
          return (
            <section key={k} className="tr-day" data-active={shown === k}>
              <header className="tr-day-head">
                <div>
                  <h3 className="tr-day-name">{day.name}</h3>
                  {day.sub && <p className="tr-day-sub">{day.sub}</p>}
                </div>
                <div className="tr-day-meta">
                  <span>
                    {done} / {total}
                  </span>
                  <button type="button" className="panel-action" onClick={() => clearDay(k)}>
                    Clear
                  </button>
                </div>
              </header>
              <ol className="tr-list">
                {day.items.map((it, n) => (
                  <li key={it.id} className="tr-row">
                    <span className="tr-num">{n + 1}</span>
                    <div className="tr-body">
                      {it.type === 'superset' ? (
                        <>
                          <div className="tr-group-label">
                            <b>{it.label}</b>
                            <span>{it.rest}</span>
                          </div>
                          <div className="tr-pair">
                            {it.exercises.map((ex) => (
                              <ExerciseBlock key={ex.id} ex={ex} weights={weights} editing={editing} onSet={setWeight} />
                            ))}
                          </div>
                          <TickRow n={it.rounds} arr={ticks[it.id]} label={(i) => `R${i + 1}`} onToggle={(i) => toggleTick(k, it.id, it.rounds, i)} />
                        </>
                      ) : it.type === 'cardio' ? (
                        <>
                          <h4 className="tr-name">{it.name}</h4>
                          <div className="tr-load">
                            <span className="tr-kg tr-kg-text">{it.scheme}</span>
                          </div>
                          {it.cue && <p className="tr-cue">{it.cue}</p>}
                          <TickRow n={1} arr={ticks[it.id]} label={() => 'Done'} onToggle={(i) => toggleTick(k, it.id, 1, i)} />
                        </>
                      ) : (
                        <>
                          <ExerciseBlock ex={it} weights={weights} editing={editing} onSet={setWeight} />
                          <TickRow n={it.sets} arr={ticks[it.id]} label={(i) => String(i + 1)} onToggle={(i) => toggleTick(k, it.id, it.sets, i)} />
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>
      {rulesHtml && (
        <details className="tr-rules">
          <summary>Rules &amp; schedule</summary>
          <div className="tr-md" dangerouslySetInnerHTML={{ __html: rulesHtml }} />
        </details>
      )}
    </Panel>
  );
}

// Full-width, 3× the standard large height — two day columns of ~9 rows each.
TrainingWidget.fixedSize = { rowSpan: 6, full: true };

registerWidget('training', TrainingWidget);
