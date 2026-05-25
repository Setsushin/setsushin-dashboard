// Panel — shared widget shell. `large` spans 2 grid rows; `compact` is 1.
// Children scroll inside `.panel-body` so widgets don't push the row taller
// than --row-h.

import type { CSSProperties, ReactNode } from 'react';
import { fixedSizeOf, useWidgetContext } from './registry';

export interface PanelProps {
  title?: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function Panel({ title, hint, action, footer, className, children }: PanelProps) {
  const ctx = useWidgetContext();
  const anchorId = ctx.type != null ? `widget-${ctx.type}-${ctx.index}` : undefined;
  const size = ctx.size === 'compact' ? 'compact' : 'large';
  const fixed = fixedSizeOf(ctx.type);
  // Explicit grid placement when ctx carries placed coords. When rendered
  // outside a grid (e.g. HeaderStrip row mode), ctx has no col/row.
  const style: CSSProperties | undefined =
    Number.isInteger(ctx.col) && Number.isInteger(ctx.row)
      ? { gridColumn: `${ctx.col} / span ${ctx.w}`, gridRow: `${ctx.row} / span ${ctx.h}` }
      : undefined;
  return (
    <section
      id={anchorId}
      className={`panel ${className ?? ''}`}
      data-size={fixed ? 'fixed' : size}
      style={style}
    >
      <div className="panel-head">
        <div className="panel-title">
          {title}
          {hint && <span className="panel-hint">{hint}</span>}
        </div>
        {action}
      </div>
      <div className="panel-body">{children}</div>
      {footer && <div className="panel-foot">{footer}</div>}
    </section>
  );
}
