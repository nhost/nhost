import type { KeyboardEvent, ReactNode } from 'react';
import type { LegendPayload } from 'recharts';
import type { ChartConfig } from '@/components/ui/v3/chart';
import { cn } from '@/lib/utils';

interface InteractiveChartLegendProps {
  config: ChartConfig;
  hiddenSet: Set<string>;
  onItemClick: (
    key: string,
    opts: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean },
  ) => void;
  onItemHover?: (key: string | null) => void;
  // Rendered next to (not inside) the item's toggle button, so it can hold its
  // own interactive content such as an info tooltip.
  renderItemAddon?: (key: string) => ReactNode;
  // Filled in by Recharts when it clones the legend passed as `content`.
  payload?: readonly LegendPayload[];
}

// The keys Recharts uses to move and toggle the chart's keyboard tooltip.
const CHART_TOOLTIP_KEYS = new Set(['Enter', 'ArrowLeft', 'ArrowRight']);

function stopChartTooltipKey(e: KeyboardEvent) {
  if (CHART_TOOLTIP_KEYS.has(e.key)) {
    e.stopPropagation();
  }
}

export default function InteractiveChartLegend({
  config,
  hiddenSet,
  onItemClick,
  onItemHover,
  renderItemAddon,
  payload,
}: InteractiveChartLegendProps) {
  if (!payload?.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
      {payload
        .filter((item) => item.type !== 'none')
        .map((item) => {
          const key = String(item.dataKey ?? '');
          const isHidden = hiddenSet.has(key);
          const label = config[key]?.label ?? key;
          const addon = renderItemAddon?.(key);
          const button = (
            <button
              key={key}
              type="button"
              // Recharts renders the legend inside the chart, so the click
              // must not also reach the chart's pin and zoom-out handlers.
              onClick={(e) => {
                e.stopPropagation();
                onItemClick(key, {
                  metaKey: e.metaKey,
                  ctrlKey: e.ctrlKey,
                  shiftKey: e.shiftKey,
                });
              }}
              onDoubleClick={(e) => e.stopPropagation()}
              // Focus and the tooltip keys would open the chart's keyboard
              // tooltip. Escape still bubbles so it can close the pinned one.
              onFocus={(e) => e.stopPropagation()}
              onKeyDown={stopChartTooltipKey}
              onMouseEnter={() => onItemHover?.(key)}
              onMouseLeave={() => onItemHover?.(null)}
              className={cn(
                'flex cursor-pointer items-center gap-1.5 text-xs leading-none transition-colors hover:text-foreground',
                isHidden ? 'text-muted-foreground/60' : 'text-foreground',
              )}
              aria-pressed={!isHidden}
              title="Click to isolate, click again to restore. Hold ⌘/Ctrl/Shift to toggle individually."
            >
              <div
                className={cn(
                  'h-2 w-2 shrink-0 rounded-[2px] transition-opacity',
                  isHidden && 'opacity-40',
                )}
                style={{ backgroundColor: item.color }}
              />
              <span>{label}</span>
            </button>
          );
          // The addon is inside the chart as well, so its clicks must not
          // reach the chart's handlers either.
          return addon ? (
            <span
              key={key}
              role="none"
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              onKeyDown={stopChartTooltipKey}
              className="flex items-center gap-1"
            >
              {button}
              {addon}
            </span>
          ) : (
            button
          );
        })}
    </div>
  );
}
