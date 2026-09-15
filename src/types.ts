// Shared domain types (D1 rows + API responses).

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
  usd?: number | null;
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
