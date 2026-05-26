// Widget registry + context. Widgets self-register by calling
// registerWidget('type', Component) at module load (a side effect), so
// importing `src/widgets` (the barrel) before first render is enough.

import { createContext, useContext } from 'react';
import type { FixedSize, WidgetComponent, WidgetContextValue, WidgetSize } from '../types';

const WIDGETS: Record<string, WidgetComponent> = {};

export function registerWidget(type: string, component: WidgetComponent): void {
  WIDGETS[type] = component;
}

export function getWidget(type: string): WidgetComponent | undefined {
  return WIDGETS[type];
}

export function widgetTypes(): string[] {
  return Object.keys(WIDGETS);
}

export function fixedSizeOf(type: string | undefined): FixedSize | undefined {
  return type ? WIDGETS[type]?.fixedSize : undefined;
}

// WidgetContext carries layout metadata into every widget so Panel can
// auto-id and span grid rows without each widget threading props through.
export const WidgetContext = createContext<WidgetContextValue>({});

export function useWidgetContext(): WidgetContextValue {
  return useContext(WidgetContext);
}

// 'compact' or 'large'. Widgets switch between two body renderings based on it.
export function useWidgetSize(): WidgetSize {
  return useContext(WidgetContext).size === 'compact' ? 'compact' : 'large';
}
