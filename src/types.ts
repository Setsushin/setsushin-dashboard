// Shared domain + layout types for the dashboard frontend.

import type { FC } from 'react';

// ── Widgets ────────────────────────────────────────────────────────────
export type WidgetSize = 'compact' | 'large';

export type WidgetConfig = Record<string, unknown>;

export interface FixedSize {
  rowSpan?: number;
  full?: boolean;
}

export interface WidgetProps {
  config?: WidgetConfig;
}

export type WidgetComponent = FC<WidgetProps> & { fixedSize?: FixedSize };

// ── Grid items ─────────────────────────────────────────────────────────
export interface GridItem {
  type: string;
  size?: WidgetSize;
  config?: WidgetConfig;
  col?: number;
  row?: number;
  w?: number;
  h?: number;
}

// A grid item after placeItems(): all geometry resolved.
export interface PlacedItem extends GridItem {
  size: WidgetSize;
  w: number;
  h: number;
  col: number;
  row: number;
}

export interface WidgetContextValue {
  type?: string;
  index?: number;
  size?: WidgetSize;
  config?: WidgetConfig;
  col?: number;
  row?: number;
  w?: number;
  h?: number;
}

// ── Layout (layout.yml + D1 overrides, merged in useLayout) ──────────────
export interface NavItem {
  id: string;
  label: string;
  icon: string;
  badge?: string | number;
}

export interface StatConfig {
  id?: string | number;
  type?: 'tasksRemaining' | 'feedCount' | 'count';
  label?: string;
  icon?: string;
  accent?: boolean;
  value?: string | number;
  sub?: string;
  bar?: number;
  items?: unknown[];
  endpoint?: string;
}

export interface Page {
  id: string;
  title?: string;
  subtitle?: string;
  stats?: StatConfig[];
  header?: GridItem[];
  grid?: GridItem[];
  userAdded?: boolean;
}

export interface LayoutYaml {
  brand?: string;
  nav?: NavItem[];
  pages?: Page[];
}

export interface Layout extends LayoutYaml {
  nav: NavItem[];
  pages: Page[];
}

export interface PageMeta {
  page_id: string;
  label?: string | null;
  icon?: string | null;
  title?: string | null;
  subtitle?: string | null;
  sort_order?: number;
}

// ── Data records (D1 + API responses) ────────────────────────────────────
export interface Me {
  email: string;
  local: boolean;
}

export interface Task {
  id: number;
  text: string;
  description?: string | null;
  tag?: string | null;
  kind?: string | null;
  done: boolean;
  due_at?: number | null;
  created_at?: number;
}

export type AssetExposure = 'jpy' | 'usd' | 'mixed-50-50';

export interface Asset {
  id: number;
  layer: string;
  sublayer?: string | null;
  name: string;
  jpy_man: number;
  exposure: AssetExposure;
  account?: string | null;
  sort_order?: number;
  updated_at?: number;
}

export interface ProfileItem {
  id: number;
  category?: string | null;
  label: string;
  value?: string | null;
  note?: string | null;
  sort_order?: number;
  updated_at?: number;
}

export interface Bookmark {
  id: number;
  bucket?: string;
  name: string;
  url: string;
  mark?: string | null;
  color?: string | null;
  sort_order?: number;
}

export interface JournalEntry {
  id: number;
  title?: string | null;
  body: string;
  tags: string[];
  created_at: number;
  updated_at: number;
}

export interface FxData {
  base: string;
  rates: Record<string, number>;
  date: string;
  source: string;
  stale?: boolean;
}

export interface MarketQuote {
  symbol: string;
  name?: string;
  price?: number | null;
  previousClose?: number | null;
  change?: number | null;
  changePercent?: number | null;
  currency?: string | null;
  error?: string;
}

export interface CalEvent {
  title: string;
  start: string;
  end?: string | null;
  location?: string;
  description?: string;
  allDay?: boolean;
  source?: string;
}

export interface CalendarSource {
  key: string;
  label: string;
}

export interface FeedItem {
  source: string;
  kind: string;
  title: string;
  link: string;
  published: string;
}

export interface AgendaItem {
  time: string;
  title: string;
  meta?: string;
  kind?: string;
}
