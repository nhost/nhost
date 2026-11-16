import type { ReactNode } from 'react';
import type { ChartConfig } from '@/components/ui/v3/chart';
import type { PinnedPayloadEntry } from '@/features/orgs/projects/common/metrics/types';

export interface TooltipEntry {
  key: string;
  label: ReactNode;
  value: number | string | undefined;
  color: string;
}

export function numericValue(entry: TooltipEntry): number {
  return typeof entry.value === 'number' ? entry.value : 0;
}

export function formatTooltipValue(
  value: number,
  valueFormatter?: (v: number) => string,
): string {
  return valueFormatter?.(value) ?? value.toLocaleString();
}

export function toEntries(
  payload: PinnedPayloadEntry[],
  config: ChartConfig,
  matchStackOrder = false,
): TooltipEntry[] {
  const entries = payload
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
  return matchStackOrder ? entries.reverse() : entries;
}
