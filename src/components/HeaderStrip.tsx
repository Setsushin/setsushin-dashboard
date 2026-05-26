// HeaderStrip — renders page.header[] as a full-width strip above the grid.
// Widgets opt into strip layout via config.layout === 'row' (see bookmarks).

import { normalizeItem } from '../lib/grid';
import { getWidget, WidgetContext } from '../widgets/registry';
import type { GridItem } from '../types';

export function HeaderStrip({ items }: { items?: GridItem[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="header-strip">
      {items.map((item, i) => {
        const Component = getWidget(item.type);
        if (!Component) return null;
        const norm = normalizeItem(item);
        return (
          <WidgetContext.Provider key={i} value={{ ...norm, index: i }}>
            <Component config={item.config} />
          </WidgetContext.Provider>
        );
      })}
    </div>
  );
}
