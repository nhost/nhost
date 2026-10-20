import type { CSSProperties, ReactNode } from 'react';
import type { ChartConfig } from '@/components/ui/v3/chart';
import type {
  PinnedPayloadEntry,
  PinnedState,
} from '@/features/orgs/projects/common/metrics/types';
import { formatTimestampFull } from '@/features/orgs/projects/common/metrics/utils/formatters';
import { cn } from '@/lib/utils';

interface TooltipEntry {
  key: string;
  label: ReactNode;
  value: number | string | undefined;
  color: string;
}

function toEntries(
  payload: PinnedPayloadEntry[],
  config: ChartConfig,
): TooltipEntry[] {
  return payload
    .filter((p) => p.type !== 'none' && p.value != null)
    .map((p) => {
      const key = String(p.dataKey ?? p.name ?? 'value');
      return {
        key,
        label: config[key]?.label ?? p.name ?? key,
        value: p.value,
        color: p.color ?? p.payload?.fill ?? 'hsl(var(--muted-foreground))',
      };
    });
}

interface TooltipCardProps {
  label: number | string | undefined;
  entries: TooltipEntry[];
  valueFormatter?: (v: number) => string;
  onClose?: VoidFunction;
  className?: string;
  style?: CSSProperties;
  interactive?: boolean;
  testId?: string;
  ariaLabel?: string;
}

function TooltipCard({
  label,
  entries,
  valueFormatter,
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
        <div className="font-medium">{formatTimestampFull(label)}</div>
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
        {entries.map((entry) => {
          const display =
            typeof entry.value === 'number'
              ? (valueFormatter?.(entry.value) ?? entry.value.toLocaleString())
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
    </div>
  );
}

interface HoverTooltipContentProps {
  config: ChartConfig;
  valueFormatter?: (v: number) => string;
  active?: boolean;
  payload?: PinnedPayloadEntry[];
  label?: number | string;
}

export function HoverTooltipContent({
  config,
  valueFormatter,
  active,
  payload,
  label,
}: HoverTooltipContentProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const entries = toEntries(payload, config);
  if (entries.length === 0) {
    return null;
  }
  return (
    <TooltipCard
      label={label}
      entries={entries}
      valueFormatter={valueFormatter}
    />
  );
}

interface PinnedTooltipProps {
  pinned: PinnedState;
  config: ChartConfig;
  valueFormatter?: (v: number) => string;
  onClose: VoidFunction;
}

export function PinnedTooltip({
  pinned,
  config,
  valueFormatter,
  onClose,
}: PinnedTooltipProps) {
  return (
    <TooltipCard
      label={pinned.label}
      entries={toEntries(pinned.payload, config)}
      valueFormatter={valueFormatter}
      onClose={onClose}
      interactive
      className="absolute z-10"
      style={{
        left: pinned.x,
        top: pinned.y,
      }}
      testId="pinned-tooltip"
      ariaLabel="Pinned data point"
    />
  );
}
