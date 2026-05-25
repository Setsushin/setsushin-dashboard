// functions/api/calendar/sources.ts — list available calendar sources.
//
// GET /api/calendar/sources → [{ key: 'primary', label: 'Primary' }, …]
//
// Derived at request time by scanning env for `CALENDAR_<KEY>_ICS` bindings.
// The ICS URLs never leave the worker — only the keys are exposed.

import { json } from '../../_lib/auth';
import type { Env } from '../../_lib/types';

export const onRequestGet: PagesFunction<Env> = ({ env }) => {
  const sources = Object.keys(env || {})
    .filter((k) => k.startsWith('CALENDAR_') && k.endsWith('_ICS'))
    .map((k) => k.slice('CALENDAR_'.length, -'_ICS'.length).toLowerCase())
    .sort()
    .map((key) => ({ key, label: key.charAt(0).toUpperCase() + key.slice(1) }));
  return json(sources, { headers: { 'cache-control': 'no-store' } });
};
