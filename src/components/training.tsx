// training — upper/lower split workout card. Plan text comes from
// public/training.yml; overrides + per-JST-day set ticks live in D1 via
// /api/training — one JSON doc per key (`weights`, `volume` for reps/sets,
// `log:YYYY-MM-DD`). One day shows at a time behind a day switch (CSS hides
// the rest).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import yaml from 'js-yaml';
import { Panel } from './Panel';
import { Heatmap, type HeatDay } from './Heatmap';
import { mockHint } from './mockHint';
import { apiFetch } from '../lib/api';
import { showToast } from '../lib/events';
import { renderMarkdown } from '../lib/markdown';
import './training.css';

interface Exercise {
  id: string;
  name: string;
  reps: string;
  load?: string;
  kg?: number | null;
  unit?: string;
  cue?: string;
  prog?: string;
}
type Item =
  | (Exercise & { type: 'single'; sets: number; rest?: string })
  | { type: 'superset'; id: string; label: string; rounds: number; rest: string; exercises: Exercise[] }
  | { type: 'cardio'; id: string; name: string; scheme: string; cue?: string };
interface Day {
  name: string;
  sub?: string;
  extra?: boolean;
  items: Item[];
}
interface Plan {
  days: Record<string, Day>;
  rules?: string;
}

type Weights = Record<string, number | null>;
// Keyed by exercise id (reps) and item id (sets — rounds for a superset).
type Volume = Record<string, { reps?: string; sets?: number }>;
type Ticks = Record<string, boolean[]>;
interface LogDoc {
  day: string;
  ticks: Ticks;
}
type Docs = Record<string, unknown>;

const JSON_HEADERS = { 'content-type': 'application/json' };

// ponytail: JST (+9h) hardcoded — single-user dashboard, user lives in JP.
const todayKey = () => 'log:' + new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

const setsOf = (it: Item, volume: Volume) =>
  it.type === 'cardio' ? 1 : volume[it.id]?.sets ?? (it.type === 'superset' ? it.rounds : it.sets);
// Clamped to the current plan: logs from before a set-count cut keep their
// extra ticks in D1, but they don't count.
const doneOf = (day: Day, ticks: Ticks, volume: Volume) =>
  day.items.reduce((s, it) => s + (ticks[it.id] ?? []).slice(0, setsOf(it, volume)).filter(Boolean).length, 0);

// Commits on blur / Enter. `parse` returns undefined to reject the input,
// which snaps it back; the key remounts it when the saved value changes.
function EditIn<T>({ value, label, className, numeric, parse, onCommit }: {
  value: string;
  label: string;
  className: string;
  numeric?: boolean;
  parse: (raw: string) => T | undefined;
  onCommit: (v: T) => void;
}) {
  return (
    <input
      key={value}
      className={className}
      inputMode={numeric ? 'decimal' : undefined}
      defaultValue={value}
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      onBlur={(e) => {
        const raw = e.target.value.trim();
        if (raw === value) return;
        const v = parse(raw);
        if (v === undefined) e.target.value = value;
        else onCommit(v);
      }}
    />
  );
}

// '' clears an override back to the plan default (null / undefined).
const parseKg = (raw: string) => (raw === '' ? null : Number.isFinite(Number(raw)) ? Number(raw) : undefined);
const parseSets = (raw: string) => (raw === '' ? null : /^\d+$/.test(raw) && +raw >= 1 && +raw <= 20 ? +raw : undefined);
const parseReps = (raw: string) => raw || null;

interface EditProps {
  weights: Weights;
  volume: Volume;
  editing: boolean;
  onWeight: (id: string, v: number | null) => void;
  onVolume: (id: string, patch: { reps?: string; sets?: number }) => void;
}

// `sets` is passed for single items only; superset exercises show reps alone.
function ExerciseBlock({ ex, sets, rest, weights, volume, editing, onWeight, onVolume }: EditProps & { ex: Exercise; sets?: number; rest?: string }) {
  const kg = weights[ex.id] ?? ex.kg ?? null;
  const reps = volume[ex.id]?.reps ?? ex.reps;
  return (
    <div className="tr-ex">
      <h4 className="tr-name">{ex.name}</h4>
      <div className="tr-load">
        {ex.load ? (
          <span className="tr-kg tr-kg-text">{ex.load}</span>
        ) : (
          <>
            {editing ? (
              <EditIn className="tr-kgin" numeric value={kg == null ? '' : String(kg)} label={`${ex.name} weight`} parse={parseKg} onCommit={(v) => onWeight(ex.id, v)} />
            ) : (
              <span className="tr-kg">{kg ?? '—'}</span>
            )}
            <span className="tr-unit">{ex.unit || 'kg'}</span>
          </>
        )}
        <span className="tr-scheme">
          {!ex.load && '× '}
          {editing ? (
            <EditIn className="tr-in tr-in-reps" value={reps} label={`${ex.name} reps`} parse={parseReps} onCommit={(v) => onVolume(ex.id, { reps: v ?? undefined })} />
          ) : (
            reps
          )}
          {sets !== undefined && (
            <>
              {' × '}
              {editing ? (
                <EditIn className="tr-in tr-in-sets" numeric value={String(sets)} label={`${ex.name} sets`} parse={parseSets} onCommit={(v) => onVolume(ex.id, { sets: v ?? undefined })} />
              ) : (
                sets
              )}
              组
            </>
          )}
          {rest && ` · ${rest}`}
        </span>
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

// Last N JST days, colored by day type. A day counts once its log has ≥1
// tick; done/total is in the cell title. Derived client-side from the docs
// GET already fetched.
function History({ plan, docs, volume, todayDate, activeDate, onPick }: { plan: Plan; docs: Docs; volume: Volume; todayDate: string; activeDate: string; onPick: (d: string) => void }) {
  const dayKeys = Object.keys(plan.days);
  const session = (date: string): HeatDay | null => {
    const doc = docs['log:' + date] as LogDoc | undefined;
    if (!doc?.day || !Object.values(doc.ticks ?? {}).some((a) => a.includes(true))) return null;
    const day = plan.days[doc.day];
    const done = day ? doneOf(day, doc.ticks, volume) : 0;
    const total = day ? day.items.reduce((s, it) => s + setsOf(it, volume), 0) : 0;
    return { count: 1, title: `${date} · ${day?.name ?? doc.day} · ${done}/${total}`, attrs: { 'data-day': dayKeys.indexOf(doc.day) } };
  };

  return (
    <details className="fold tr-hist">
      <summary>
        History
        <span className="tr-hist-legend">
          {dayKeys.map((k, i) => (
            <span key={k}>
              <i className="tr-swatch" data-day={i} /> {plan.days[k].name}
            </span>
          ))}
        </span>
      </summary>
      <div className="fold-body">
        <Heatmap today={todayDate} active={activeDate} noun="sessions" day={session} onPick={onPick} />
      </div>
    </details>
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
  const volume = (docs.volume ?? {}) as Volume;
  const log = docs[logKey] as LogDoc | undefined;
  const ticks = log?.ticks ?? {};
  const dayKeys = plan ? Object.keys(plan.days) : [];

  // Default day: today's session if one is logged, else the rotation day after
  // the latest rotation log (missed session → next in sequence; `extra` days
  // don't advance it), else the first.
  const cycle = dayKeys.filter((k) => !plan?.days[k]?.extra);
  const lastCycleDay = Object.keys(docs)
    .filter((k) => k.startsWith('log:'))
    .sort()
    .map((k) => (docs[k] as LogDoc | undefined)?.day)
    .filter((d): d is string => !!d && cycle.includes(d))
    .pop();
  const defaultDay =
    (docs[today] as LogDoc | undefined)?.day ??
    (lastCycleDay ? cycle[(cycle.indexOf(lastCycleDay) + 1) % cycle.length] : dayKeys[0]);
  const shown = active ?? defaultDay;

  const toggleTick = (day: string, id: string, n: number, i: number) => {
    const arr = Array.from({ length: Math.max(n, ticks[id]?.length ?? 0) }, (_, j) => ticks[id]?.[j] ?? false);
    arr[i] = !arr[i];
    save(logKey, { day, ticks: { ...ticks, [id]: arr } });
  };
  const setWeight = (id: string, v: number | null) => save('weights', { ...weights, [id]: v });
  const setVolume = (id: string, patch: { reps?: string; sets?: number }) => save('volume', { ...volume, [id]: { ...volume[id], ...patch } });
  const edit: EditProps = { weights, volume, editing, onWeight: setWeight, onVolume: setVolume };
  const pickDate = (d: string) => {
    setEditDate(d === todayDate ? null : d);
    const day = (docs['log:' + d] as LogDoc | undefined)?.day;
    if (day) setActive(day);
  };

  if (!plan) {
    return (
      <Panel size="full" rows={6} hint={mockHint({ error: planError })}>
        <div className="tr-empty">{planError ? 'Could not load training.yml' : 'Loading…'}</div>
      </Panel>
    );
  }

  const action = (
    <button type="button" className="panel-action" aria-pressed={editing} onClick={() => setEditing((v) => !v)}>
      {editing ? 'Done' : 'Edit'}
    </button>
  );

  return (
    <Panel size="full" rows={6} action={action}>
      <History plan={plan} docs={docs} volume={volume} todayDate={todayDate} activeDate={editDate ?? todayDate} onPick={pickDate} />
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
          const total = day.items.reduce((s, it) => s + setsOf(it, volume), 0);
          const done = doneOf(day, ticks, volume);
          return (
            <section key={k} className="tr-day" data-active={shown === k}>
              <header className="tr-day-head">
                <div>
                  <h3 className="tr-day-name">{day.name}</h3>
                  {day.sub && <p className="tr-day-sub">{day.sub}</p>}
                </div>
                <div className="tr-day-meta">
                  {done} / {total}
                </div>
              </header>
              <ol className="tr-list">
                {day.items.map((it, n) => {
                  const sets = setsOf(it, volume);
                  return (
                    <li key={it.id} className="tr-row">
                      <span className="tr-num">{n + 1}</span>
                      <div className="tr-body">
                        {it.type === 'superset' ? (
                          <>
                            <div className="tr-group-label">
                              <b>{it.label}</b>
                              <span>
                                {editing ? (
                                  <EditIn className="tr-in tr-in-sets" numeric value={String(sets)} label={`${it.label} rounds`} parse={parseSets} onCommit={(v) => setVolume(it.id, { sets: v ?? undefined })} />
                                ) : (
                                  sets
                                )}
                                轮 · {it.rest}
                              </span>
                            </div>
                            <div className="tr-pair">
                              {it.exercises.map((ex) => (
                                <ExerciseBlock key={ex.id} ex={ex} {...edit} />
                              ))}
                            </div>
                            <TickRow n={sets} arr={ticks[it.id]} label={(i) => `R${i + 1}`} onToggle={(i) => toggleTick(k, it.id, sets, i)} />
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
                            <ExerciseBlock ex={it} sets={sets} rest={it.rest} {...edit} />
                            <TickRow n={sets} arr={ticks[it.id]} label={(i) => String(i + 1)} onToggle={(i) => toggleTick(k, it.id, sets, i)} />
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
      {rulesHtml && (
        <details className="fold tr-rules">
          <summary>Rules &amp; schedule</summary>
          <div className="fold-body tr-md" dangerouslySetInnerHTML={{ __html: rulesHtml }} />
        </details>
      )}
    </Panel>
  );
}
