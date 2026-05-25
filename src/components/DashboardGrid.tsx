// DashboardGrid — the main panel grid. placeItems fills in {col, row} for any
// item without explicit positions (legacy data); positioned items keep theirs.

import { placeItems } from '../lib/grid';
import { getWidget, WidgetContext } from '../widgets/registry';
import type { GridItem } from '../types';

export function DashboardGrid({ items }: { items?: GridItem[] }) {
  const placed = placeItems(items ?? []);
  return (
    <div className="grid">
      {placed.map((item, i) => {
        const Component = getWidget(item.type);
        const cellStyle = {
          gridColumn: `${item.col} / span ${item.w}`,
          gridRow: `${item.row} / span ${item.h}`,
        };
        if (!Component) {
          return (
            <section key={i} id={`widget-${item.type}-${i}`} className="panel" style={cellStyle}>
              <div className="panel-head">
                <div className="panel-title">
                  unknown widget: <code>{item.type}</code>
                </div>
              </div>
              <div className="muted" style={{ padding: 12 }}>
                Did you forget to register <code>widgets/{item.type}</code>?
              </div>
            </section>
          );
        }
        return (
          <WidgetContext.Provider key={i} value={{ ...item, index: i }}>
            <Component config={item.config} />
          </WidgetContext.Provider>
        );
      })}
    </div>
  );
}
