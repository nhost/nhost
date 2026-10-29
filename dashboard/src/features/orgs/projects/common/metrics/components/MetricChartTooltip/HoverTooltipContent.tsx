import type { ChartConfig } from '@/components/ui/v3/chart';
import type { PinnedPayloadEntry } from '@/features/orgs/projects/common/metrics/types';
import TooltipCard, { type TooltipOptions } from './TooltipCard';
import { toEntries } from './toEntries';

interface HoverTooltipContentProps extends TooltipOptions {
  config: ChartConfig;
  active?: boolean;
  payload?: PinnedPayloadEntry[];
  label?: number | string;
}

export default function HoverTooltipContent({
  config,
  valueFormatter,
  labelFormatter,
  matchStackOrder,
  maxEntries,
  renderFooter,
  active,
  payload,
  label,
}: HoverTooltipContentProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const entries = toEntries(payload, config, matchStackOrder);
  if (entries.length === 0) {
    return null;
  }
  return (
    <TooltipCard
      label={label}
      entries={entries}
      valueFormatter={valueFormatter}
      labelFormatter={labelFormatter}
      maxEntries={maxEntries}
      renderFooter={renderFooter}
    />
  );
}
