// assets — Portfolio widget backed by D1 (/api/assets + /api/fx).
// Rows are stored as a JPY part (jpy_man, 万円) + a USD part (usd, $) split
// by exposure; the live total is recomputed from /api/fx on render, so USD-
// exposed rows float with the rate. The currency toggle is display-only.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Panel } from './Panel';
import { mockHint } from './mockHint';
import { useFetch } from '../hooks/useFetch';
import { apiFetch } from '../lib/api';
import { showToast } from '../lib/events';
import { tint } from '../lib/color';
import { fromMan, parseAmount, parseAsset, withLiveJpy, type AmountUnit } from './assets-utils';
import type { Asset, AssetExposure, FxData } from '../types';
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
function buildMarkdown(items: Asset[], fx: Rates, date?: string): string {
  const today = date ?? new Date().toISOString().slice(0, 10);
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
  usd: number | null;
  sublayer: null;
  exposure: AssetExposure;
  account: string | null;
}

function AssetForm({
  initial,
  layer: defaultLayer,
  usdRate,
  onSave,
  onCancel,
}: {
  initial: Asset | null;
  layer: string;
  usdRate: number | undefined;
  onSave: (form: AssetFormValues) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  // Pre-fill in the row's own unit (USD rows as "$", others as the live total
  // in m-shorthand 10.2万 → "10.2m") so the field round-trips without drift.
  const isUsd = initial?.exposure === 'usd' && initial.usd != null;
  const [jpyMan, setJpyMan] = useState(isUsd ? String(initial.usd) : initial?.jpy_man != null ? `${initial.jpy_man}m` : '');
  const [unit, setUnit] = useState<AmountUnit>(isUsd ? 'usd' : 'yen');
  const [layer, setLayer] = useState(initial?.layer ?? defaultLayer);
  const [exposure, setExposure] = useState<AssetExposure>(initial?.exposure ?? 'jpy');
  const [account, setAccount] = useState(initial?.account ?? '');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    nameRef.current?.select();
  }, []);

  // Switching units converts the field in place (10.2万 ↔ $652.8 ↔ ¥102000)
  // so a pre-filled edit value never gets silently reinterpreted in the new
  // unit. Unconvertible (no rate / unparseable) clears the field instead.
  const switchUnit = (next: AmountUnit) => {
    const man = parseAmount(jpyMan, usdRate, unit);
    const disp = man === null ? null : fromMan(man, next, usdRate);
    setJpyMan(disp === null ? '' : String(disp));
    setUnit(next);
  };

  const submit = () => {
    const amount = parseAsset(jpyMan, usdRate, exposure, unit);
    if (!name.trim() || !amount) return;
    onSave({
      layer,
      name: name.trim(),
      ...amount,
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
        className="field af-name"
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="af-amount-wrap">
        <input
          className="field af-amount"
          inputMode="decimal"
          placeholder={unit === 'usd' ? 'USD' : '円'}
          title="$…=USD · ¥…=円 (符号优先于下拉) · k=千 m=万"
          value={jpyMan}
          onChange={(e) => setJpyMan(e.target.value)}
        />
        <select className="field af-unit" value={unit} onChange={(e) => switchUnit(e.target.value as AmountUnit)}>
          <option value="yen">¥</option>
          <option value="usd">$</option>
        </select>
      </div>
      <select className="field af-layer" value={layer} onChange={(e) => setLayer(e.target.value)}>
        {LAYER_ORDER.map((L) => (
          <option key={L} value={L}>
            {L}
          </option>
        ))}
      </select>
      <select
        className="field af-exp"
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
        className="field af-acct"
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

// Amount-only inline editor. Enter/blur commit, Esc cancels, Tab commits and
// asks the parent to move to the adjacent row (shift-Tab = previous).
function AmountInline({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (raw: string, dir?: 1 | -1) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (commit: boolean, dir?: 1 | -1) => {
    if (done.current) return;
    done.current = true;
    if (commit) onCommit(ref.current?.value ?? '', dir);
    else onCancel();
  };
  return (
    <input
      ref={ref}
      className="field assets-amount-inline"
      defaultValue={initial}
      inputMode="decimal"
      onBlur={() => finish(true)}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finish(true);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          finish(false);
        } else if (e.key === 'Tab') {
          e.preventDefault();
          finish(true, e.shiftKey ? -1 : 1);
        }
      }}
    />
  );
}

function AssetRow({
  item,
  grand,
  ccy,
  fx,
  amountEditing,
  onAmountStart,
  onAmountCommit,
  onAmountCancel,
  onEditStart,
  onDelete,
}: {
  item: Asset;
  grand: number;
  ccy: string;
  fx: Rates;
  amountEditing: boolean;
  onAmountStart: () => void;
  onAmountCommit: (raw: string, dir?: 1 | -1) => void;
  onAmountCancel: () => void;
  onEditStart: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="assets-row" onDoubleClick={onEditStart}>
      <span className="assets-row-name">{item.name}</span>
      {amountEditing ? (
        <AmountInline
          initial={item.exposure === 'usd' && item.usd != null ? `$${item.usd}` : String(item.jpy_man)}
          onCommit={onAmountCommit}
          onCancel={onAmountCancel}
        />
      ) : (
        <span
          className="assets-row-amount"
          onClick={onAmountStart}
          title="Click to edit — plain=万円, $…=USD, ¥…=円, k=千 m=万 · Tab jumps to the next row"
        >
          {fmtAmount(item.jpy_man, ccy, fx)}
        </span>
      )}
      <span className="assets-row-pct">{pct(item.jpy_man, grand)}%</span>
      <span className={`chip assets-row-tag ex-${item.exposure}`}>{EXPOSURE_LABEL[item.exposure] ?? item.exposure}</span>
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

interface Snapshot {
  id: number;
  taken_at: number;
  data: Asset[];
}

// Chip acknowledgement flash: true for 1.4s after arm(), then auto-resets.
function useAck(): [boolean, () => void] {
  const [ack, setAck] = useState(false);
  useEffect(() => {
    if (!ack) return;
    const t = setTimeout(() => setAck(false), 1400);
    return () => clearTimeout(t);
  }, [ack]);
  return [ack, useCallback(() => setAck(true), [])];
}

// `snaps · N` chip + dropdown: save-today, ranged markdown export, and the
// list of saved snapshots (date · rows · total). Follows the UserMenu
// outside-click/Escape pattern.
function SnapsMenu({
  snaps,
  canSave,
  onSave,
}: {
  snaps: Snapshot[] | null;
  canSave: boolean;
  onSave: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState('30');
  const [saveAck, armSaveAck] = useAck();
  const [copyAck, armCopyAck] = useAck();
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const save = async () => {
    try {
      await onSave();
      armSaveAck();
    } catch (err) {
      showToast('Snapshot failed: ' + (err as Error).message, 'error');
    }
  };

  const copy = async () => {
    const cutoff = range === 'all' ? 0 : Date.now() / 1000 - Number(range) * 86400;
    const inRange = (snaps || []).filter((s) => s.taken_at >= cutoff);
    if (!inRange.length) {
      showToast('No snapshots in range', 'info');
      return;
    }
    try {
      const md = inRange
        .map((s) => buildMarkdown(s.data, undefined, new Date(s.taken_at * 1000).toLocaleDateString('sv-SE')))
        .join('\n\n---\n\n');
      await navigator.clipboard.writeText(md);
      armCopyAck();
    } catch (err) {
      showToast('Copy failed: ' + (err as Error).message, 'error');
    }
  };

  return (
    <span className="snaps-menu" ref={wrapRef}>
      <button
        className="chip assets-md-chip"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open ? 'true' : 'false'}
        title="Asset snapshots"
      >
        snaps · {snaps ? snaps.length : '…'} ▾
      </button>
      {open && (
        <div className="snaps-pop">
          <div className="snaps-pop-actions">
            <button
              className="chip assets-md-chip"
              onClick={save}
              disabled={!canSave}
              data-ack={saveAck ? '1' : '0'}
              title="Save a dated snapshot (same-day saves overwrite)"
            >
              {saveAck ? '✓ saved' : 'save today'}
            </button>
            <select className="chip assets-hist-range" value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="7">7d</option>
              <option value="30">30d</option>
              <option value="90">90d</option>
              <option value="all">all</option>
            </select>
            <button
              className="chip assets-md-chip"
              onClick={copy}
              data-ack={copyAck ? '1' : '0'}
              title="Copy snapshot history as Markdown (for LLM)"
            >
              {copyAck ? '✓ copied' : 'copy · md'}
            </button>
          </div>
          <div className="snaps-pop-list">
            {(snaps || [])
              .slice()
              .reverse()
              .map((s) => (
                <div key={s.id} className="snaps-pop-row">
                  <span>{new Date(s.taken_at * 1000).toLocaleDateString('sv-SE')}</span>
                  <span className="muted">{s.data.length} rows</span>
                  <span className="snaps-pop-total">
                    {Math.round(s.data.reduce((t, a) => t + a.jpy_man, 0)).toLocaleString('en-US')}万
                  </span>
                </div>
              ))}
            {snaps && !snaps.length && <div className="snaps-pop-empty muted">No snapshots yet</div>}
          </div>
        </div>
      )}
    </span>
  );
}

export function Assets() {
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [ccy, setCcy] = useState<Ccy>('JPY');
  const [view, setView] = useState<View>('layer');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [amountEditId, setAmountEditId] = useState<number | null>(null);
  const [addingLayer, setAddingLayer] = useState<string | null>(null);
  const [copyAck, armCopyAck] = useAck();
  const [snaps, setSnaps] = useState<Snapshot[] | null>(null);

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

  // ponytail: pulls every snapshot's full data just to count/list; at one
  // row per day that's tiny — add a ?meta=1 mode if it ever hurts.
  const loadSnaps = useCallback(() => {
    return fetch('/api/asset-snapshots')
      .then((r) => (r.ok ? (r.json() as Promise<Snapshot[]>) : []))
      .then(setSnaps)
      .catch(() => setSnaps([]));
  }, []);
  useEffect(() => {
    void loadSnaps();
  }, [loadSnaps]);

  const saveSnap = async () => {
    await apiFetch('/api/asset-snapshots', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ usd_rate: fx?.USD }),
    });
    await loadSnaps();
  };

  const items = fx?.USD ? withLiveJpy(assets || [], fx.USD) : [];
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

  const updateAmount = (id: number, amount: { jpy_man: number; usd: number | null }) =>
    mutate(
      () => setAssets((a) => (a || []).map((it) => (it.id === id ? { ...it, ...amount } : it))),
      () =>
        apiFetch(`/api/assets/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(amount),
        }),
    );

  // Row order as rendered (layers in order, collapsed layers skipped) — the
  // Tab-flow path for inline amount editing.
  const visibleIds = LAYER_ORDER.flatMap((L) =>
    collapsed[L] ? [] : items.filter((i) => i.layer === L).map((i) => i.id),
  );

  const commitAmount = (item: Asset, raw: string, dir?: 1 | -1) => {
    const i = visibleIds.indexOf(item.id);
    const nextId = dir ? (visibleIds[i + dir] ?? null) : null;
    const v = parseAsset(raw, fx?.USD, item.exposure);
    if (!v) {
      showToast('Invalid amount — plain=万円, $…=USD, ¥…=円, k=千 m=万', 'error');
      setAmountEditId(null);
      return;
    }
    const stored = (assets || []).find((a) => a.id === item.id);
    if (v.jpy_man !== stored?.jpy_man || v.usd !== (stored?.usd ?? null)) void updateAmount(item.id, v);
    setAmountEditId(nextId);
  };

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
      armCopyAck();
    } catch (err) {
      showToast('Copy failed: ' + (err as Error).message, 'error');
    }
  };

  const title = (
    <span className="assets-title">
      <span>Portfolio</span>
      <button
        className="chip assets-md-chip"
        onClick={onCopyMd}
        disabled={!items.length}
        data-ack={copyAck ? '1' : '0'}
        title="Copy portfolio as Markdown (for LLM)"
      >
        {copyAck ? '✓ copied' : 'copy · md'}
      </button>
      <SnapsMenu snaps={snaps} canSave={!!items.length} onSave={saveSnap} />
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

  if (assets === null || !fx?.USD) {
    return (
      <Panel size="full" rows={3} title={title} action={action}>
        <div className="empty">
          Loading…
        </div>
      </Panel>
    );
  }

  const groups = buildHierarchy(items, view);

  return (
    <Panel size="full" rows={3} title={title} hint={fxStaleHint} action={action}>
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
                          usdRate={fx?.USD}
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
                          amountEditing={amountEditId === it.id}
                          onAmountStart={() => setAmountEditId(it.id)}
                          onAmountCommit={(raw, dir) => commitAmount(it, raw, dir)}
                          onAmountCancel={() => setAmountEditId(null)}
                          onEditStart={() => setEditingId(it.id)}
                          onDelete={() => remove(it.id, it.name)}
                        />
                      ),
                    )}
                    {addingLayer === layer ? (
                      <AssetForm
                        layer={layer}
                        initial={null}
                        usdRate={fx?.USD}
                        onSave={create}
                        onCancel={() => setAddingLayer(null)}
                      />
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
            <div className="empty">
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
