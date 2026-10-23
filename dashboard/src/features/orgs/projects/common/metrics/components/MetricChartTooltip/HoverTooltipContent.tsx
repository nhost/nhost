import type { ChartConfig } from '@/components/ui/v3/chart';
import type { PinnedPayloadEntry } from '@/features/orgs/projects/common/metrics/types';
import TooltipCard from './TooltipCard';
import { toEntries } from './toEntries';

interface HoverTooltipContentProps {
  config: ChartConfig;
  valueFormatter?: (v: number) => string;
  active?: boolean;
  payload?: PinnedPayloadEntry[];
  label?: number | string;
}

export default function HoverTooltipContent({
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
