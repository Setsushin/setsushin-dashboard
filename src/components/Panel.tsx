// Panel — shared card shell. `size` sets the grid footprint (see .grid in
// styles.css): compact 1×1, large 1×2, full = every column. `rows` overrides
// the row span for tall full-width panels. Children scroll inside
// `.panel-body` so content never pushes the row taller than --row-h.

import type { ReactNode } from 'react';

export type PanelSize = 'compact' | 'large' | 'full';

export interface PanelProps {
  title?: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  className?: string;
  size?: PanelSize;
  rows?: number;
  children?: ReactNode;
}

export function Panel({ title, hint, action, className, size = 'large', rows, children }: PanelProps) {
  return (
    <section
      className={`panel ${className ?? ''}`}
      data-size={size}
      style={rows ? { gridRow: `span ${rows}` } : undefined}
    >
      <div className="panel-head">
        <div className="panel-title">
          {title}
          {hint && <span className="panel-hint">{hint}</span>}
        </div>
        {action}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}
