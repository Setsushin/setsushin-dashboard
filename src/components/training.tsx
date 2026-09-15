// training — upper/lower split workout card. Plan text comes from
// public/training.yml; weights + per-JST-day set ticks live in D1 via
// /api/training — one JSON doc per key (`weights`, `log:YYYY-MM-DD`). Both
// days render side by side; under 900px one column with a day switch (CSS).

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import yaml from 'js-yaml';
import { Panel } from './Panel';
import { mockHint } from './mockHint';
import { apiFetch } from '../lib/api';
import { showToast } from '../lib/events';
import { renderMarkdown } from '../lib/markdown';
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

const DAY_MS = 86400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const monthDays = (y: number, m: number) =>
  Array.from({ length: new Date(Date.UTC(y, m, 0)).getUTCDate() }, (_, i) => isoDay(Date.UTC(y, m - 1, i + 1)));

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

type HistMode = '14d' | 'month' | 'year';

// One cell per JST day, filled when that day's log has ≥1 tick. Fill opacity
// scales with done/total against the current plan. Everything is derived
// client-side from the docs GET already fetched — no extra endpoint.
function History({ plan, docs, todayDate, activeDate, onPick }: { plan: Plan; docs: Docs; todayDate: string; activeDate: string; onPick: (d: string) => void }) {
  const [mode, setMode] = useState<HistMode>('14d');
  const [ym, setYm] = useState(todayDate.slice(0, 7));
  const dayKeys = Object.keys(plan.days);
  const [y, m] = ym.split('-').map(Number);
  const loggedYears = Object.keys(docs)
    .filter((k) => k.startsWith('log:') && (docs[k] as LogDoc | undefined)?.day)
    .map((k) => k.slice(4, 8));
  const years = [...new Set([todayDate.slice(0, 4), ym.slice(0, 4), ...loggedYears])].sort().reverse();

  const rows: { label?: string; days: string[] }[] =
    mode === '14d'
      ? [{ days: Array.from({ length: 14 }, (_, i) => isoDay(Date.parse(todayDate) - (13 - i) * DAY_MS)) }]
      : mode === 'month'
        ? [{ days: monthDays(y, m) }]
        : Array.from({ length: 12 }, (_, i) => ({ label: String(i + 1), days: monthDays(y, i + 1) }));

  const cell = (d: string) => {
    const doc = docs['log:' + d] as LogDoc | undefined;
    const day = doc?.day ? plan.days[doc.day] : undefined;
    const done = Object.values(doc?.ticks ?? {}).reduce((s, a) => s + a.filter(Boolean).length, 0);
    const total = day ? day.items.reduce((s, it) => s + tickCount(it), 0) : 0;
    const trained = done > 0 && !!doc?.day;
    return (
      <button
        key={d}
        type="button"
        className="tr-hcell"
        data-day={trained ? dayKeys.indexOf(doc!.day) : undefined}
        data-today={d === todayDate || undefined}
        data-active={d === activeDate || undefined}
        disabled={d > todayDate}
        title={trained ? `${d} · ${day?.name ?? doc!.day} · ${done}/${total}` : d}
        style={trained ? ({ '--fill': 0.5 + 0.5 * (total ? Math.min(done / total, 1) : 1) } as CSSProperties) : undefined}
        onClick={() => onPick(d)}
      >
        {mode !== 'year' && Number(d.slice(8))}
      </button>
    );
  };

  return (
    <div className="tr-hist">
      <div className="tr-hist-head">
        <span className="label-mono">History</span>
        <select className="tr-hist-sel" value={mode} onChange={(e) => setMode(e.target.value as HistMode)}>
          <option value="14d">Last 14 days</option>
          <option value="month">Month</option>
          <option value="year">Year</option>
        </select>
        {mode === 'month' && (
          <input
            className="tr-hist-sel"
            type="month"
            value={ym}
            max={todayDate.slice(0, 7)}
            onChange={(e) => e.target.value && setYm(e.target.value)}
          />
        )}
        {mode === 'year' && (
          <select className="tr-hist-sel" value={String(y)} onChange={(e) => setYm(`${e.target.value}-${ym.slice(5)}`)}>
            {years.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        )}
        <span className="tr-hist-legend">
          {dayKeys.map((k, i) => (
            <span key={k}>
              <i className="tr-hcell" data-day={i} /> {plan.days[k].name}
            </span>
          ))}
        </span>
      </div>
      <div className="tr-hist-grid" data-mode={mode}>
        {rows.map((r, i) => (
          <div key={i} className="tr-hrow" style={{ '--n': r.days.length } as CSSProperties}>
            {r.label && <span className="tr-hrow-label">{r.label}</span>}
            {r.days.map(cell)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Training() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planError, setPlanError] = useState<Error | null>(null);
  const [docs, setDocs] = useState<Docs>({});
  const [editing, setEditing] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('training.yml')
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
  }, []);

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
  const todayDate = today.slice(4);
  // Backfill: a picked History cell redirects ticks/Clear to that day's log.
  const logKey = editDate ? 'log:' + editDate : today;
  const weights = (docs.weights ?? {}) as Weights;
  const log = docs[logKey] as LogDoc | undefined;
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
    save(logKey, { day, ticks: { ...ticks, [id]: arr } });
  };
  const clearDay = (day: string) => {
    if (!log || !plan) return;
    const ids = new Set(plan.days[day].items.map((it) => it.id));
    const rest = Object.fromEntries(Object.entries(ticks).filter(([id]) => !ids.has(id)));
    save(logKey, { day: log.day, ticks: rest });
  };
  const setWeight = (id: string, v: number | null) => save('weights', { ...weights, [id]: v });
  const pickDate = (d: string) => {
    setEditDate(d === todayDate ? null : d);
    const day = (docs['log:' + d] as LogDoc | undefined)?.day;
    if (day) setActive(day);
  };

  if (!plan) {
    return (
      <Panel size="full" rows={6} title="Training" hint={mockHint({ error: planError })}>
        <div className="tr-empty">{planError ? 'Could not load training.yml' : 'Loading…'}</div>
      </Panel>
    );
  }

  const action = (
    <button type="button" className="panel-action tr-edit" aria-pressed={editing} onClick={() => setEditing((v) => !v)}>
      {editing ? 'Done' : 'Edit weights'}
    </button>
  );

  return (
    <Panel size="full" rows={6} title="Training" action={action}>
      <History plan={plan} docs={docs} todayDate={todayDate} activeDate={editDate ?? todayDate} onPick={pickDate} />
      {editDate && (
        <div className="tr-editing">
          Editing {editDate}
          <button type="button" className="panel-action" onClick={() => setEditDate(null)}>
            Back to today
          </button>
        </div>
      )}
      <div className="seg seg-fill tr-switch" role="group" aria-label="Day">
        {dayKeys.map((k) => (
          <button key={k} type="button" className="seg-btn" aria-pressed={shown === k} onClick={() => setActive(k)}>
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
