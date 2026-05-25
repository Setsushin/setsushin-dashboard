// markets — Yahoo Finance quotes via /api/markets.
//
//   - type: markets
//     config: { endpoint: /api/markets, symbols: [{ symbol, name }] }

import { Panel } from './Panel';
import { registerWidget, useWidgetSize } from './registry';
import { mockHint } from './mockHint';
import { useFetch } from '../hooks/useFetch';
import type { MarketQuote, WidgetProps } from '../types';
import './markets.css';

interface SymbolMeta {
  symbol: string;
  name?: string;
}

const MARKETS_MOCK: MarketQuote[] = [
  { symbol: 'SPY', price: 569.45, previousClose: 567.83, changePercent: 0.29, currency: 'USD' },
  { symbol: 'BTC-USD', price: 87432.1, previousClose: 86120.55, changePercent: 1.52, currency: 'USD' },
  { symbol: 'JPY=X', price: 156.42, previousClose: 156.83, changePercent: -0.26, currency: 'JPY' },
  { symbol: '^TNX', price: 4.234, previousClose: 4.198, changePercent: 0.86, currency: '%' },
  { symbol: '^N225', price: 38924.55, previousClose: 38712.1, changePercent: 0.55, currency: 'JPY' },
];

function MarketsWidget({ config }: WidgetProps) {
  const size = useWidgetSize();
  const symbols = (config?.symbols as SymbolMeta[] | undefined) ?? [];
  const endpoint = config?.endpoint as string | undefined;
  const symList = symbols.map((s) => s.symbol).join(',');
  const url = endpoint && symList ? `${endpoint}?symbols=${encodeURIComponent(symList)}` : null;
  const { data, loading, error } = useFetch<MarketQuote[]>(url, { ttl: 5 * 60_000, fallback: MARKETS_MOCK });

  // Worker returns 200 even when upstream blocks — surface "all errored".
  const allErrored = Array.isArray(data) && data.length > 0 && data.every((m) => m.error);
  const source = error || allErrored ? MARKETS_MOCK : data ?? [];

  const rows = source.map((m) => {
    const meta = symbols.find((s) => s.symbol === m.symbol);
    return { ...m, name: meta?.name ?? m.symbol };
  });

  const hint = mockHint({ error, allErrored, reason: 'upstream blocked' });

  if (size === 'compact') {
    const sorted = [...rows]
      .filter((r) => r.changePercent != null)
      .sort((a, b) => Math.abs(b.changePercent!) - Math.abs(a.changePercent!));
    const top = sorted[0];
    return (
      <Panel title="Markets" hint={hint}>
        <div className="markets-compact">
          {top ? (
            <>
              <div className="mc-top">
                <span className="mc-name">{top.name}</span>
                <span className={`market-change ${top.changePercent! >= 0 ? 'up' : 'down'}`}>
                  {top.changePercent! >= 0 ? '+' : ''}
                  {top.changePercent!.toFixed(2)}%
                </span>
              </div>
              <div className="mc-meta">{rows.length} symbols tracked · top mover today</div>
            </>
          ) : (
            <div className="muted">Loading…</div>
          )}
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Markets" hint={hint}>
      <div className="markets">
        {rows.map((m) => {
          const change = m.changePercent ?? 0;
          const up = change >= 0;
          return (
            <div key={m.symbol} className="market-row">
              <div className="market-meta">
                <div className="market-name">{m.name}</div>
                <div className="market-symbol">{m.symbol}</div>
              </div>
              <div className="market-vals">
                <div className="market-price">{formatPrice(m.price, m.currency)}</div>
                <div className={`market-change ${up ? 'up' : 'down'}`}>
                  {up ? '+' : ''}
                  {change.toFixed(2)}%
                </div>
              </div>
            </div>
          );
        })}
        {loading && rows.length === 0 && <div className="muted" style={{ padding: 8 }}>Loading…</div>}
      </div>
    </Panel>
  );
}

function formatPrice(p: number | null | undefined, currency: string | null | undefined): string {
  if (p == null) return '—';
  const digits = p > 1000 ? 0 : p > 10 ? 2 : 3;
  const symbol = currency === 'USD' ? '$' : currency === 'JPY' ? '¥' : '';
  return `${symbol}${p.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

registerWidget('markets', MarketsWidget);
