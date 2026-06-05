import type { ChartConfig } from '@/components/ui/v3/chart';
import { cn } from '@/lib/utils';

interface LegendPayloadItem {
  dataKey?: string | number;
  color?: string;
  type?: string;
}

interface InteractiveChartLegendProps {
  config: ChartConfig;
  hiddenSet: Set<string>;
  onItemClick: (
    key: string,
    opts: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean },
  ) => void;
  onItemHover?: (key: string | null) => void;
  payload?: LegendPayloadItem[];
}

export default function InteractiveChartLegend({
  config,
  hiddenSet,
  onItemClick,
  onItemHover,
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
          return (
            <button
              key={key}
              type="button"
              onClick={(e) =>
                onItemClick(key, {
                  metaKey: e.metaKey,
                  ctrlKey: e.ctrlKey,
                  shiftKey: e.shiftKey,
                })
              }
              onDoubleClick={(e) => e.stopPropagation()}
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
        })}
    </div>
  );
}
