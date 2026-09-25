// Heatmap — last N days behind a 365d/90d/30d switch: 365d as a week-column
// heatmap, 90d/30d as a one-row strip filling the width. Cells are clickable;
// color comes from the caller's CSS keyed off the `attrs` it returns per day.

import { cloneElement, useEffect, useRef, useState } from 'react';
import { ActivityCalendar, type Activity } from 'react-activity-calendar';
import './Heatmap.css';

export interface HeatDay {
  count: number;
  title: string;
  attrs?: Record<string, string | number | undefined>;
}

const RANGES = [365, 90, 30];
const BLOCK_GAP = 3;
const DAY_MS = 86400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function Heatmap({
  today,
  active,
  noun,
  day,
  onPick,
}: {
  today: string;
  active?: string;
  noun: string;
  day: (date: string) => HeatDay | null;
  onPick: (date: string) => void;
}) {
  const [range, setRange] = useState(RANGES[0]);
  const [width, setWidth] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    if (rootRef.current) ro.observe(rootRef.current);
    return () => ro.disconnect();
  }, []);
  const cell = (date: string) => {
    const d = day(date);
    return {
      ...d?.attrs,
      'data-today': date === today || undefined,
      'data-active': date === active || undefined,
      onClick: () => onPick(date),
      title: d?.title ?? date,
    };
  };
  const data: Activity[] = Array.from({ length: range }, (_, i) => {
    const date = isoDay(Date.parse(today) - (range - 1 - i) * DAY_MS);
    const count = day(date)?.count ?? 0;
    return { date, count, level: count ? 1 : 0 };
  });
  const countLabel = `${noun} in the last ${range} days`;
  // Fit 365d's week columns to the width (32px ≈ weekday labels); the clamp
  // keeps it legible on phones (it scrolls) and sane on huge screens.
  const weeks = Math.ceil(((new Date(data[0].date).getUTCDay() + 6) % 7 + range) / 7);
  const blockSize = Math.max(10, Math.min(40, Math.floor((width - 32) / weeks) - BLOCK_GAP));
  // Strip ticks: Mondays as M/D on 30d, month starts on 90d.
  const tick = (date: string) => {
    const d = new Date(date);
    if (range === 30) return d.getUTCDay() === 1 ? `${d.getUTCMonth() + 1}/${d.getUTCDate()}` : null;
    return d.getUTCDate() === 1 ? d.toLocaleString('en', { month: 'short', timeZone: 'UTC' }) : null;
  };
  const cols = { gridTemplateColumns: `repeat(${range}, minmax(0, 1fr))` };

  return (
    <div ref={rootRef}>
      <div className="seg heat-range" role="group" aria-label="Range">
        {RANGES.map((n) => (
          <button key={n} type="button" className="seg-btn" aria-pressed={range === n} onClick={() => setRange(n)}>
            {n}d
          </button>
        ))}
      </div>
      {range === 365 ? (
        <ActivityCalendar
          className="heat"
          data={data}
          maxLevel={1}
          weekStart={1}
          blockSize={blockSize}
          blockMargin={BLOCK_GAP}
          blockRadius={Math.max(2, Math.round(blockSize / 6))}
          fontSize={11}
          showColorLegend={false}
          showWeekdayLabels={['mon', 'wed', 'fri']}
          labels={{ totalCount: `{{count}} ${countLabel}` }}
          renderBlock={(block, a) => {
            const { title, ...attrs } = cell(a.date);
            return cloneElement(block, { ...attrs, style: undefined } as Partial<typeof block.props>, <title>{title}</title>);
          }}
        />
      ) : (
        <div className="heat-strip" data-range={range}>
          <div className="heat-strip-ticks" style={cols}>
            {data.map((a, i) => {
              const t = tick(a.date);
              return t && <span key={a.date} style={{ gridColumn: i + 1 }}>{t}</span>;
            })}
          </div>
          <div className="heat-strip-cells" style={cols}>
            {data.map((a) => (
              <button key={a.date} type="button" className="heat-strip-cell" {...cell(a.date)} />
            ))}
          </div>
          <div className="heat-strip-foot">
            {data.reduce((s, a) => s + a.count, 0)} {countLabel}
          </div>
        </div>
      )}
    </div>
  );
}
