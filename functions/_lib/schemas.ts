// functions/_lib/schemas.ts — single source of truth for request-body
// validation at the system boundary. Each resource has an `insert` schema
// (with defaults, for POST/PUT) and a `patch` schema (all-optional, no
// defaults, clearable columns `.nullable()`). The schema IS the type:
// domain types are `z.infer`. These schemas live only in functions/ — the
// front-end keeps its own hand-written `src/types.ts` (boundary stays clean).
//
// The coercion quirks here are deliberate, not incidental: trim, empty→null,
// String() coerce, exposure lowercase whitelist, due_at positive integer.
// Tag (de)serialization stays in _lib/journal-tags.ts.

import { z } from 'zod';
import { parseTags, serializeTags } from './journal-tags';

// Trimmed string → null when empty. Used for clearable text columns.
const emptyToNull = (s: string) => s.trim() || null;

// Unix-seconds timestamp: '' / null → null, else a positive integer.
const dueAt = z.preprocess(
  (v) => (v == null || v === '' ? null : v),
  z.coerce.number().int().positive().nullable(),
);

// ─── tasks ─────────────────────────────────────────────────────────────────

export const taskInsert = z.object({
  text: z.string().trim().min(1),
  description: z.string().transform(emptyToNull).nullable().optional(),
  tag: z.coerce.string().nullable().optional(),
  kind: z.coerce.string().nullable().optional(),
  done: z.boolean().default(false),
  due_at: dueAt.optional(),
});

export const taskPatch = z.object({
  text: z.string().min(1).optional(),
  description: z.string().transform(emptyToNull).nullable().optional(),
  tag: z.coerce.string().nullable().optional(),
  kind: z.coerce.string().nullable().optional(),
  done: z.boolean().optional(),
  due_at: dueAt.optional(),
});

export type TaskInsert = z.infer<typeof taskInsert>;

export interface TaskRow {
  id: number;
  text: string;
  description: string | null;
  tag: string | null;
  kind: string | null;
  done: number;
  due_at: number | null;
  created_at: number;
}

export const rowToTask = (r: TaskRow) => ({ ...r, done: r.done === 1 });

// ─── assets ──────────────────────────────────────────────────────────────--

const exposure = z.preprocess(
  (v) => (typeof v === 'string' ? v.toLowerCase() : v),
  z.enum(['jpy', 'usd', 'mixed-50-50']),
);

export const assetInsert = z.object({
  layer: z.string().trim().min(1),
  name: z.string().trim().min(1),
  jpy_man: z.coerce.number().finite(),
  exposure,
  sublayer: z.coerce.string().nullable().optional(),
  account: z.string().transform(emptyToNull).nullable().optional(),
  sort_order: z.coerce.number().finite().catch(0),
});

export const assetPatch = z.object({
  layer: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  jpy_man: z.coerce.number().finite().optional(),
  exposure: exposure.optional(),
  sublayer: z.coerce.string().nullable().optional(),
  account: z.string().transform(emptyToNull).nullable().optional(),
  sort_order: z.coerce.number().finite().optional(),
});

// ─── bookmarks ───────────────────────────────────────────────────────────--

export const bookmarkInsert = z.object({
  bucket: z.string().trim().min(1),
  name: z.string().trim().min(1),
  url: z.string().trim().min(1),
  mark: z.string().transform(emptyToNull).nullable().optional(),
  color: z.string().transform(emptyToNull).nullable().optional(),
  sort_order: z.coerce.number().finite().catch(0),
});

export const bookmarkPatch = z.object({
  name: z.coerce.string().transform((s) => s.trim()).optional(),
  url: z.coerce.string().transform((s) => s.trim()).optional(),
  mark: z.string().transform(emptyToNull).nullable().optional(),
  color: z.string().transform(emptyToNull).nullable().optional(),
  sort_order: z.coerce.number().finite().catch(0).optional(),
});

// ─── profile ─────────────────────────────────────────────────────────────--

export const profileInsert = z.object({
  label: z.string().trim().min(1),
  category: z.string().transform(emptyToNull).nullable().optional(),
  value: z.string().catch(''),
  note: z.string().transform(emptyToNull).nullable().optional(),
  sort_order: z.coerce.number().finite().catch(0),
});

export const profilePatch = z.object({
  label: z.string().trim().min(1).optional(),
  category: z.string().transform(emptyToNull).nullable().optional(),
  value: z.string().optional(),
  note: z.string().transform(emptyToNull).nullable().optional(),
  sort_order: z.coerce.number().finite().optional(),
});

// ─── journal ─────────────────────────────────────────────────────────────--
// body + title validate via zod; tags stays raw here and is handed to
// serializeTags / parseTags so PATCH and POST share one (de)serializer.

const journalTitle = z.string().transform((s) => s.trim() || null).nullable().optional();

export const journalInsert = z.object({
  body: z.string().trim().min(1),
  title: journalTitle,
  tags: z.unknown().optional(),
});

export const journalPatch = z.object({
  body: z.string().trim().min(1).optional(),
  title: journalTitle,
  tags: z.array(z.unknown()).nullable().optional(),
});

export { serializeTags };

export interface JournalRow {
  id: number;
  title: string | null;
  body: string;
  tags: string | null;
  created_at: number;
  updated_at: number;
}

export const rowToJournal = (r: JournalRow) => ({ ...r, tags: parseTags(r.tags) });

// ─── layout / pages (PUT) ─────────────────────────────────────────────────--

export const layoutPut = z.object({
  page_id: z.string(),
  grid: z.array(z.unknown()),
});

const pageText = z.string().transform((s) => s.trim() || null).nullable().optional();

export const pagesPut = z.object({
  label: pageText,
  icon: pageText,
  title: pageText,
  subtitle: pageText,
  sort_order: z.coerce.number().finite().catch(100),
});
