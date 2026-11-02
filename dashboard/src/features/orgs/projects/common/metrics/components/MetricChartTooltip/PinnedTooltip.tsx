import type { ChartConfig } from '@/components/ui/v3/chart';
import type { PinnedState } from '@/features/orgs/projects/common/metrics/types';
import TooltipCard, { type TooltipOptions } from './TooltipCard';
import { toEntries } from './toEntries';

interface PinnedTooltipProps extends TooltipOptions {
  pinned: PinnedState;
  config: ChartConfig;
  onClose: VoidFunction;
}

export default function PinnedTooltip({
  pinned,
  config,
  valueFormatter,
  labelFormatter,
  matchStackOrder,
  maxEntries,
  renderFooter,
  onClose,
}: PinnedTooltipProps) {
  return (
    <TooltipCard
      label={pinned.label}
      entries={toEntries(pinned.payload, config, matchStackOrder)}
      valueFormatter={valueFormatter}
      labelFormatter={labelFormatter}
      maxEntries={maxEntries}
      renderFooter={renderFooter}
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
