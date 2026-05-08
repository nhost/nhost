import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useMemo } from 'react';
import GridLayout, { type Layout, WidthProvider } from 'react-grid-layout';
import {
  GRID_COLS,
  GRID_GUTTER,
  GRID_ROW_HEIGHT,
} from '@/features/orgs/projects/overview/dashboard/templates';
import type {
  DashboardLayout,
  LayoutItem,
  WidgetConfig,
} from '@/features/orgs/projects/overview/dashboard/types';
import Widget from '@/features/orgs/projects/overview/dashboard/Widget';
import { WIDGET_RENDERERS } from '@/features/orgs/projects/overview/dashboard/widgets';

const ResponsiveGridLayout = WidthProvider(GridLayout);

type DashboardGridProps = {
  layout: DashboardLayout;
  editing: boolean;
  onChange: (next: DashboardLayout) => void;
  onRemove: (id: string) => void;
  onUpdateConfig: (id: string, cfg: Partial<WidgetConfig>) => void;
};

function toRGL(item: LayoutItem): Layout {
  return {
    i: item.i,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    minW: item.minW,
    minH: item.minH,
  };
}

export default function DashboardGrid({
  layout,
  editing,
  onChange,
  onRemove,
}: DashboardGridProps) {
  const rglLayout = useMemo(() => layout.map(toRGL), [layout]);
  const itemsById = useMemo(
    () => new Map(layout.map((it) => [it.i, it])),
    [layout],
  );

  function handleLayoutChange(next: Layout[]) {
    const merged = next
      .map((entry) => {
        const original = itemsById.get(entry.i);
        if (!original) {
          return null;
        }
        return {
          ...original,
          x: entry.x,
          y: entry.y,
          w: entry.w,
          h: entry.h,
        };
      })
      .filter(Boolean) as DashboardLayout;

    const sameOrder =
      merged.length === layout.length &&
      merged.every(
        (m, i) =>
          m.i === layout[i].i &&
          m.x === layout[i].x &&
          m.y === layout[i].y &&
          m.w === layout[i].w &&
          m.h === layout[i].h,
      );
    if (!sameOrder) {
      onChange(merged);
    }
  }

  return (
    <ResponsiveGridLayout
      className="dashboard-grid"
      layout={rglLayout}
      cols={GRID_COLS}
      rowHeight={GRID_ROW_HEIGHT}
      margin={[GRID_GUTTER, GRID_GUTTER]}
      isDraggable={editing}
      isResizable={editing}
      compactType={null}
      preventCollision={false}
      onLayoutChange={handleLayoutChange}
      draggableCancel=".dashboard-no-drag, button, input, textarea, a"
      resizeHandles={['se']}
    >
      {layout.map((item) => {
        const Renderer = WIDGET_RENDERERS[item.type];
        return (
          <div key={item.i} data-grid={toRGL(item)}>
            <Widget editing={editing} onRemove={() => onRemove(item.i)}>
              {Renderer ? <Renderer cfg={item.cfg} /> : null}
            </Widget>
          </div>
        );
      })}
    </ResponsiveGridLayout>
  );
}
