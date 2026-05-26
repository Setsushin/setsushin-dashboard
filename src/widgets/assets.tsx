// assets — Portfolio widget backed by D1 (/api/assets + /api/fx).
// All edits are kept in 万JPY (the canonical unit); the currency toggle is
// display-only.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Panel } from './Panel';
import { registerWidget } from './registry';
import { mockHint } from './mockHint';
import { useFetch } from '../hooks/useFetch';
import { apiFetch } from '../lib/api';
import { showToast } from '../lib/events';
import { tint } from '../lib/color';
import type { Asset, AssetExposure, FxData, WidgetProps } from '../types';
import './assets.css';

const LAYER_META: Record<string, { label: string; color: string }> = {
  L1: { label: 'Cash', color: '#7da27c' },
  L2: { label: 'Bonds/MMF/Stable', color: '#9caf88' },
  L3: { label: 'Taxable 风险资产', color: '#d4a574' },
  L4: { label: 'NISA Stocks', color: '#c97c5d' },
};
const LAYER_ORDER = ['L1', 'L2', 'L3', 'L4'];

const CCY_META: Record<string, { label: string; color: string }> = {
  jpy: { label: 'JPY exposure', color: '#a8967b' },
  usd: { label: 'Non-JPY exposure', color: '#d4a574' },
};

const EXPOSURE_MIXED = 'mixed-50-50';
const EXPOSURE_OPTIONS: Array<{ value: AssetExposure; label: string }> = [
  { value: 'jpy', label: 'JPY' },
  { value: 'usd', label: 'USD' },
  { value: EXPOSURE_MIXED, label: 'Mix 50/50' },
];
const EXPOSURE_LABEL: Record<string, string> = { jpy: 'JPY', usd: 'USD', [EXPOSURE_MIXED]: 'mix' };
const EXPOSURE_LABEL_LONG: Record<string, string> = { jpy: 'JPY', usd: 'USD', [EXPOSURE_MIXED]: 'mix 50/50' };

type Rates = Record<string, number> | undefined;

interface CcyDisplay {
  decimals: number;
  suffix: string;
  mul: (man: number, fx?: Rates) => number;
}
const CCY_DISP: Record<string, CcyDisplay> = {
  JPY: { decimals: 0, suffix: '万円', mul: (man) => man },
  USD: { decimals: 1, suffix: 'K USD', mul: (man, fx) => man * (fx?.USD || 0) * 10 },
  CNY: { decimals: 1, suffix: '万CNY', mul: (man, fx) => man * (fx?.CNY || 0) },
};

function fmtAmount(jpyMan: number, ccy: string, fx: Rates): string {
  const spec = CCY_DISP[ccy] || CCY_DISP.JPY;
  const v = spec.mul(jpyMan, fx);
  return v.toLocaleString('en-US', { minimumFractionDigits: spec.decimals, maximumFractionDigits: spec.decimals });
}

function pct(num: number, denom: number): string {
  return denom > 0 ? ((num / denom) * 100).toFixed(1) : '0.0';
}

function arcPath(cx: number, cy: number, rIn: number, rOut: number, startA: number, endA: number): string {
  const x1 = cx + rOut * Math.cos(startA);
  const y1 = cy + rOut * Math.sin(startA);
  const x2 = cx + rOut * Math.cos(endA);
  const y2 = cy + rOut * Math.sin(endA);
  const x3 = cx + rIn * Math.cos(endA);
  const y3 = cy + rIn * Math.sin(endA);
  const x4 = cx + rIn * Math.cos(startA);
  const y4 = cy + rIn * Math.sin(startA);
  const large = endA - startA > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${rOut} ${rOut} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${rIn} ${rIn} 0 ${large} 0 ${x4} ${y4} Z`;
}

type Child = Asset & { color: string; _ccy?: string };
interface Group {
  key: string;
  label: string;
  color: string;
  total: number;
  children: Child[];
}

function byLayer(items: Asset[]): Group[] {
  return LAYER_ORDER.map((layer) => {
    const children = items.filter((i) => i.layer === layer);
    return {
      key: layer,
      label: LAYER_META[layer].label,
      color: LAYER_META[layer].color,
      total: children.reduce((s, i) => s + i.jpy_man, 0),
      children: children.map((c) => ({ ...c, color: LAYER_META[layer].color })),
    };
  }).filter((g) => g.total > 0);
}

function byCurrency(items: Asset[]): Group[] {
  const expanded: Array<Asset & { _ccy: string }> = items.flatMap((it) =>
    it.exposure === EXPOSURE_MIXED
      ? [
          { ...it, _ccy: 'jpy', jpy_man: it.jpy_man / 2 },
          { ...it, _ccy: 'usd', jpy_man: it.jpy_man / 2 },
        ]
      : [{ ...it, _ccy: it.exposure }],
  );
  return ['jpy', 'usd']
    .map((c) => {
      const children = expanded.filter((i) => i._ccy === c);
      return {
        key: c,
        label: CCY_META[c].label,
        color: CCY_META[c].color,
        total: children.reduce((s, i) => s + i.jpy_man, 0),
        children: children.map((ch) => ({ ...ch, color: LAYER_META[ch.layer].color })),
      };
    })
    .filter((g) => g.total > 0);
}

function buildHierarchy(items: Asset[], mode: string): Group[] {
  return mode === 'layer' ? byLayer(items) : byCurrency(items);
}

// LLM-friendly snapshot. Always emits 万JPY plus current FX rates.
function buildMarkdown(items: Asset[], fx: Rates): string {
  const today = new Date().toISOString().slice(0, 10);
  const grand = items.reduce((s, i) => s + i.jpy_man, 0);
  const fmt = (n: number, d = 1) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const lines: string[] = [];
  lines.push(`# Portfolio — ${today}`, '');
  lines.push(`Total: ${fmt(grand)} 万JPY`);
  if (fx?.USD || fx?.CNY) {
    const parts: string[] = [];
    if (fx.USD) parts.push(`1 JPY = ${fx.USD} USD`);
    if (fx.CNY) parts.push(`1 JPY = ${fx.CNY} CNY`);
    lines.push(`FX: ${parts.join(', ')}`);
  }
  lines.push('');

  for (const L of LAYER_ORDER) {
    const layerItems = items.filter((i) => i.layer === L);
    if (!layerItems.length) continue;
    const total = layerItems.reduce((s, i) => s + i.jpy_man, 0);
    lines.push(`## ${L} — ${LAYER_META[L].label} · ${fmt(total)} 万JPY (${pct(total, grand)}%)`);
    for (const it of layerItems) {
      const meta = [EXPOSURE_LABEL_LONG[it.exposure] ?? it.exposure, it.account].filter(Boolean).join(' · ');
      lines.push(`- ${it.name} — ${fmt(it.jpy_man)} 万JPY (${pct(it.jpy_man, grand)}%) · ${meta}`);
    }
    lines.push('');
  }

  const ccyGroups = byCurrency(items);
  if (ccyGroups.length) {
    lines.push('## Currency exposure');
    for (const g of ccyGroups) {
      lines.push(`- ${g.label}: ${fmt(g.total)} 万JPY (${pct(g.total, grand)}%)`);
    }
  }
  return lines.join('\n');
}

interface GroupTip {
  kind: 'group';
  label: string;
  amount: number;
  pct: number;
}
interface ItemTip {
  kind: 'item';
  label: string;
  amount: number;
  pct: number;
  layer: string;
  exposure: AssetExposure;
  account?: string | null;
}
type Tip = GroupTip | ItemTip;
type Hover = Tip & { x: number; y: number };

interface Slice {
  key: string;
  d: string;
  color: string;
  tip: Tip;
}

function Sunburst({ groups, ccy, fx, total }: { groups: Group[]; ccy: string; fx: Rates; total: number }) {
  const SIZE = 280;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R_IN1 = 56;
  const R_OUT1 = 84;
  const R_IN2 = 86;
  const R_OUT2 = 124;
  const TWO_PI = Math.PI * 2;
  const offset = -Math.PI / 2;

  const [hover, setHover] = useState<Hover | null>(null);

  const { inner, outer } = useMemo(() => {
    const grand = groups.reduce((s, g) => s + g.total, 0) || 1;
    const innerSlices: Slice[] = [];
    const outerSlices: Slice[] = [];
    let acc = 0;
    for (const g of groups) {
      const sweep = (g.total / grand) * TWO_PI;
      const a0 = offset + acc;
      const a1 = offset + acc + sweep;
      innerSlices.push({
        key: `i-${g.key}`,
        d: arcPath(CX, CY, R_IN1, R_OUT1, a0, a1),
        color: g.color,
        tip: { kind: 'group', label: g.label, amount: g.total, pct: (g.total / grand) * 100 },
      });
      let innerAcc = 0;
      for (const c of g.children) {
        const cs = (c.jpy_man / g.total) * sweep;
        const ca0 = a0 + innerAcc;
        const ca1 = a0 + innerAcc + cs;
        outerSlices.push({
          key: `o-${g.key}-${c.id}-${c._ccy || ''}`,
          d: arcPath(CX, CY, R_IN2, R_OUT2, ca0, ca1),
          color: tint(c.color, 0.25),
          tip: {
            kind: 'item',
            label: c.name,
            amount: c.jpy_man,
            pct: (c.jpy_man / grand) * 100,
            layer: c.layer,
            exposure: c.exposure,
            account: c.account,
          },
        });
        innerAcc += cs;
      }
      acc += sweep;
    }
    return { inner: innerSlices, outer: outerSlices };
  }, [groups]);

  const onMove = (tip: Tip) => (e: React.MouseEvent<SVGPathElement>) => {
    const wrap = e.currentTarget.closest('.sunburst-wrap');
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const x = Math.min(rect.width - 200, e.clientX - rect.left + 14);
    const y = Math.min(rect.height - 90, e.clientY - rect.top + 14);
    setHover({ ...tip, x, y });
  };

  const slicePath = (s: Slice) => (
    <path
      key={s.key}
      d={s.d}
      fill={s.color}
      stroke="var(--bg-content)"
      strokeWidth="1"
      style={{ opacity: hover && hover.label !== s.tip.label ? 0.45 : 1 }}
      onMouseEnter={onMove(s.tip)}
      onMouseMove={onMove(s.tip)}
    />
  );

  return (
    <div className="sunburst-wrap" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="sunburst" width="100%" preserveAspectRatio="xMidYMid meet">
        {inner.map(slicePath)}
        {outer.map(slicePath)}
        <text x={CX} y={CY - 6} textAnchor="middle" className="sunburst-total">
          {fmtAmount(total, ccy, fx)}
        </text>
        <text x={CX} y={CY + 12} textAnchor="middle" className="sunburst-total-suffix">
          {CCY_DISP[ccy].suffix}
        </text>
      </svg>
      {hover && <SunburstTip hover={hover} ccy={ccy} fx={fx} />}
    </div>
  );
}

function SunburstTip({ hover, ccy, fx }: { hover: Hover; ccy: string; fx: Rates }) {
  return (
    <div className="sunburst-tip" style={{ left: hover.x, top: hover.y }}>
      <div className="tip-name">{hover.label}</div>
      <div className="tip-amount">
        {fmtAmount(hover.amount, ccy, fx)} <span className="tip-suffix">{CCY_DISP[ccy].suffix}</span>
        <span className="tip-pct">{hover.pct.toFixed(1)}%</span>
      </div>
      {hover.kind === 'item' && (
        <div className="tip-meta">
          {hover.layer}
          {' · '}
          {EXPOSURE_LABEL_LONG[hover.exposure] ?? hover.exposure}
          {hover.account && ` · ${hover.account}`}
        </div>
      )}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button
          key={o.value}
          className={`seg-btn ${value === o.value ? 'is-active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface AssetFormValues {
  layer: string;
  name: string;
  jpy_man: number;
  sublayer: null;
  exposure: AssetExposure;
  account: string | null;
}

function AssetForm({
  initial,
  layer: defaultLayer,
  onSave,
  onCancel,
}: {
  initial: Asset | null;
  layer: string;
  onSave: (form: AssetFormValues) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [jpyMan, setJpyMan] = useState(initial?.jpy_man != null ? String(initial.jpy_man) : '');
  const [layer, setLayer] = useState(initial?.layer ?? defaultLayer);
  const [exposure, setExposure] = useState<AssetExposure>(initial?.exposure ?? 'jpy');
  const [account, setAccount] = useState(initial?.account ?? '');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    nameRef.current?.select();
  }, []);

  const submit = () => {
    const value = parseFloat(jpyMan);
    if (!name.trim() || !Number.isFinite(value)) return;
    onSave({
      layer,
      name: name.trim(),
      jpy_man: value,
      sublayer: null,
      exposure,
      account: account.trim() || null,
    });
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="assets-row assets-row-form" onKeyDown={onKey}>
      <input
        ref={nameRef}
        className="af-input af-name"
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="af-input af-amount"
        type="number"
        step="0.1"
        placeholder="万JPY"
        value={jpyMan}
        onChange={(e) => setJpyMan(e.target.value)}
      />
      <select className="af-input af-layer" value={layer} onChange={(e) => setLayer(e.target.value)}>
        {LAYER_ORDER.map((L) => (
          <option key={L} value={L}>
            {L}
          </option>
        ))}
      </select>
      <select
        className="af-input af-exp"
        value={exposure}
        onChange={(e) => setExposure(e.target.value as AssetExposure)}
      >
        {EXPOSURE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <input
        className="af-input af-acct"
        placeholder="Account"
        value={account ?? ''}
        onChange={(e) => setAccount(e.target.value)}
      />
      <div className="af-actions">
        <button className="af-btn af-save" onClick={submit} title="Save (Enter)">
          ✓
        </button>
        <button className="af-btn af-cancel" onClick={onCancel} title="Cancel (Esc)">
          ✕
        </button>
      </div>
    </div>
  );
}

function AssetRow({
  item,
  grand,
  ccy,
  fx,
  onEditStart,
  onDelete,
}: {
  item: Asset;
  grand: number;
  ccy: string;
  fx: Rates;
  onEditStart: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="assets-row">
      <span className="assets-row-name">{item.name}</span>
      <span className="assets-row-amount">{fmtAmount(item.jpy_man, ccy, fx)}</span>
      <span className="assets-row-pct">{pct(item.jpy_man, grand)}%</span>
      <span className={`assets-row-tag ex-${item.exposure}`}>{EXPOSURE_LABEL[item.exposure] ?? item.exposure}</span>
      <span className="assets-row-account muted">{item.account}</span>
      <div className="assets-row-actions">
        <button className="assets-row-act" onClick={onEditStart} title="Edit">
          ✎
        </button>
        <button className="assets-row-act assets-row-del" onClick={onDelete} title="Delete">
          ×
        </button>
      </div>
    </div>
  );
}

type Ccy = 'JPY' | 'USD' | 'CNY';
type View = 'layer' | 'currency';

function AssetsWidget({ config }: WidgetProps) {
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [ccy, setCcy] = useState<Ccy>((config?.default_currency as Ccy) || 'JPY');
  const [view, setView] = useState<View>('layer');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [addingLayer, setAddingLayer] = useState<string | null>(null);
  const [copyAck, setCopyAck] = useState(false);

  const fxState = useFetch<FxData>('/api/fx?base=JPY&symbols=USD,CNY', { ttl: 60 * 60_000 });
  const fx = fxState.data?.rates;

  const reload = useCallback(() => {
    return fetch('/api/assets')
      .then((r) => (r.ok ? (r.json() as Promise<Asset[]>) : []))
      .then(setAssets)
      .catch(() => setAssets([]));
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  const items = assets || [];
  const grandJpyMan = items.reduce((s, i) => s + i.jpy_man, 0);

  const mutate = async (
    optimistic: () => void,
    doFetch: () => Promise<Response>,
    { reloadOnSuccess = false }: { reloadOnSuccess?: boolean } = {},
  ) => {
    optimistic();
    try {
      await doFetch();
      if (reloadOnSuccess) void reload();
    } catch (err) {
      console.error(err);
      showToast(`${(err as Error).message} — reverted`, 'error');
      void reload();
    }
  };

  const create = (form: AssetFormValues) =>
    mutate(
      () => {
        setAddingLayer(null);
        setAssets((a) => [...(a || []), { ...form, id: -Date.now() }]);
      },
      () =>
        apiFetch('/api/assets', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(form),
        }),
      { reloadOnSuccess: true },
    );

  const update = (id: number, patch: AssetFormValues) =>
    mutate(
      () => {
        setEditingId(null);
        setAssets((a) => (a || []).map((it) => (it.id === id ? { ...it, ...patch } : it)));
      },
      () =>
        apiFetch(`/api/assets/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(patch),
        }),
    );

  const remove = (id: number, name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    return mutate(
      () => setAssets((a) => (a || []).filter((it) => it.id !== id)),
      () => apiFetch(`/api/assets/${id}`, { method: 'DELETE' }),
    );
  };

  const onCopyMd = async () => {
    if (!items.length) return;
    try {
      await navigator.clipboard.writeText(buildMarkdown(items, fx));
      setCopyAck(true);
    } catch (err) {
      showToast('Copy failed: ' + (err as Error).message, 'error');
    }
  };
  useEffect(() => {
    if (!copyAck) return;
    const t = setTimeout(() => setCopyAck(false), 1400);
    return () => clearTimeout(t);
  }, [copyAck]);

  const title = (
    <span className="assets-title">
      <span>Portfolio</span>
      <button
        className="assets-md-chip"
        onClick={onCopyMd}
        disabled={!items.length}
        data-ack={copyAck ? '1' : '0'}
        title="Copy portfolio as Markdown (for LLM)"
      >
        {copyAck ? '✓ copied' : 'copy · md'}
      </button>
    </span>
  );

  const action = (
    <Segmented<Ccy>
      value={ccy}
      onChange={setCcy}
      options={[
        { value: 'JPY', label: 'JPY' },
        { value: 'USD', label: 'USD' },
        { value: 'CNY', label: 'CNY' },
      ]}
    />
  );

  const fxStaleHint = fxState.data?.stale ? mockHint({ error: new Error('stale'), reason: `fx ${fxState.data.source}` }) : null;

  if (assets === null) {
    return (
      <Panel title={title} action={action} className="panel-wide">
        <div className="muted" style={{ padding: 16 }}>
          Loading…
        </div>
      </Panel>
    );
  }

  const groups = buildHierarchy(items, view);

  return (
    <Panel title={title} hint={fxStaleHint} action={action} className="panel-wide">
      <div className="assets-split">
        <div className="assets-list">
          {LAYER_ORDER.map((layer) => {
            const layerItems = items.filter((i) => i.layer === layer);
            const layerTotal = layerItems.reduce((s, i) => s + i.jpy_man, 0);
            const isCollapsed = !!collapsed[layer];

            return (
              <div key={layer} className="assets-layer">
                <div
                  className="assets-layer-head"
                  onClick={() => setCollapsed((c) => ({ ...c, [layer]: !c[layer] }))}
                >
                  <span className="assets-layer-caret">{isCollapsed ? '▶' : '▼'}</span>
                  <span className="assets-layer-color" style={{ background: LAYER_META[layer].color }} />
                  <span className="assets-layer-name">
                    {layer} {LAYER_META[layer].label}
                  </span>
                  <span className="assets-layer-amount">{fmtAmount(layerTotal, ccy, fx)}</span>
                  <span className="assets-layer-pct">{pct(layerTotal, grandJpyMan)}%</span>
                </div>
                {!isCollapsed && (
                  <div className="assets-layer-body">
                    {layerItems.map((it) =>
                      editingId === it.id ? (
                        <AssetForm
                          key={it.id}
                          layer={layer}
                          initial={it}
                          onSave={(form) => update(it.id, form)}
                          onCancel={() => setEditingId(null)}
                        />
                      ) : (
                        <AssetRow
                          key={it.id}
                          item={it}
                          grand={grandJpyMan || 1}
                          ccy={ccy}
                          fx={fx}
                          onEditStart={() => setEditingId(it.id)}
                          onDelete={() => remove(it.id, it.name)}
                        />
                      ),
                    )}
                    {addingLayer === layer ? (
                      <AssetForm layer={layer} initial={null} onSave={create} onCancel={() => setAddingLayer(null)} />
                    ) : (
                      <button className="assets-add-btn" onClick={() => setAddingLayer(layer)}>
                        + Add to {layer}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <div className="assets-grand">
            <span>Total</span>
            <span className="assets-grand-amount">
              {fmtAmount(grandJpyMan, ccy, fx)}{' '}
              <span className="muted" style={{ fontSize: 11 }}>
                {CCY_DISP[ccy].suffix}
              </span>
            </span>
          </div>
        </div>

        <div className="assets-chart">
          <div className="assets-chart-toolbar">
            <Segmented<View>
              value={view}
              onChange={setView}
              options={[
                { value: 'layer', label: 'by Layer' },
                { value: 'currency', label: 'by Currency' },
              ]}
            />
          </div>
          {grandJpyMan > 0 ? (
            <Sunburst groups={groups} ccy={ccy} fx={fx} total={grandJpyMan} />
          ) : (
            <div className="muted" style={{ padding: 60, textAlign: 'center' }}>
              No assets yet — add one on the left.
            </div>
          )}
          <div className="assets-chart-legend">
            {groups.map((g) => (
              <div key={g.key} className="assets-legend-row">
                <span className="assets-legend-dot" style={{ background: g.color }} />
                <span className="assets-legend-label">{g.label}</span>
                <span className="assets-legend-pct">{pct(g.total, grandJpyMan)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

// Pin the Portfolio's footprint: full-width + 1.5× the standard large height.
AssetsWidget.fixedSize = { rowSpan: 3, full: true };

registerWidget('assets', AssetsWidget);
