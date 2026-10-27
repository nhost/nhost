import type { CSSProperties, ReactNode } from 'react';
import { formatTimestampFull } from '@/features/orgs/projects/common/metrics/utils/formatters';
import { cn } from '@/lib/utils';
import {
  formatTooltipValue,
  numericValue,
  type TooltipEntry,
} from './toEntries';

export interface TooltipCardOptions {
  valueFormatter?: (v: number) => string;
  labelFormatter?: (timestamp: number) => string;
  // Lists only this many rows, the largest values in their usual order, and
  // sums the rest into one "+N more" row. The footer still gets every entry.
  maxEntries?: number;
  renderFooter?: (
    entries: TooltipEntry[],
    label: number | string | undefined,
  ) => ReactNode;
}

// Shared by the hover and the pinned tooltip.
export interface TooltipOptions extends TooltipCardOptions {
  // Recharts draws the first series at the bottom of a stacked bar but lists
  // it first, so the tooltip reads upside down. This flips the list to match
  // the bar.
  matchStackOrder?: boolean;
}

interface TooltipCardProps extends TooltipCardOptions {
  label: number | string | undefined;
  entries: TooltipEntry[];
  onClose?: VoidFunction;
  className?: string;
  style?: CSSProperties;
  interactive?: boolean;
  testId?: string;
  ariaLabel?: string;
}

function toListedEntries(
  entries: TooltipEntry[],
  maxEntries = Number.POSITIVE_INFINITY,
): TooltipEntry[] {
  if (entries.length <= maxEntries) {
    return entries;
  }
  const largestKeys = new Set(
    [...entries]
      .sort((a, b) => numericValue(b) - numericValue(a))
      .slice(0, maxEntries)
      .map((entry) => entry.key),
  );
  const rest = entries.filter((entry) => !largestKeys.has(entry.key));
  return [
    ...entries.filter((entry) => largestKeys.has(entry.key)),
    {
      key: 'more-entries',
      label: `+${rest.length} more`,
      value: rest.reduce((sum, entry) => sum + numericValue(entry), 0),
      color: 'transparent',
    },
  ];
}

function formatLabel(
  label: number | string | undefined,
  labelFormatter?: (timestamp: number) => string,
): string {
  return labelFormatter && typeof label === 'number'
    ? labelFormatter(label)
    : formatTimestampFull(label);
}

export default function TooltipCard({
  label,
  entries,
  valueFormatter,
  labelFormatter,
  maxEntries,
  renderFooter,
  onClose,
  className,
  style,
  interactive = false,
  testId,
  ariaLabel,
}: TooltipCardProps) {
  return (
    <div
      className={cn(
        'grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-foreground text-xs shadow-xl',
        interactive && 'pointer-events-auto select-text',
        className,
      )}
      style={style}
      data-testid={testId}
      {...(onClose ? { role: 'dialog', 'aria-label': ariaLabel } : {})}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="font-medium">{formatLabel(label, labelFormatter)}</div>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            'shrink-0 text-muted-foreground hover:text-foreground',
            !onClose && 'pointer-events-none invisible',
          )}
          aria-label="Close pinned tooltip"
          aria-hidden={!onClose}
          tabIndex={onClose ? 0 : -1}
        >
          ×
        </button>
      </div>
      <div className="grid gap-1.5">
        {toListedEntries(entries, maxEntries).map((entry) => {
          const display =
            typeof entry.value === 'number'
              ? formatTooltipValue(entry.value, valueFormatter)
              : String(entry.value ?? '');
          return (
            <div key={entry.key} className="flex w-full items-center gap-2">
              <div
                className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: entry.color }}
              />
              <div className="flex flex-1 items-center justify-between gap-4 leading-none">
                <span className="text-muted-foreground">{entry.label}</span>
                <span className="font-medium font-mono text-foreground tabular-nums">
                  {display}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {renderFooter?.(entries, label)}
    </div>
  );
}
