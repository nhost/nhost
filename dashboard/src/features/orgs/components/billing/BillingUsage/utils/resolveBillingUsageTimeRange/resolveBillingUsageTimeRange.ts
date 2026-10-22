import { DAY_MS } from '@/features/orgs/components/billing/BillingUsage/constants';
import type {
  BillingUsageRangeBounds,
  BillingUsageRangePreset,
  BillingUsageTimeRange,
  ResolvedBillingUsageTimeRange,
} from '@/features/orgs/components/billing/BillingUsage/types';
import { previousBillingCycleStart } from '@/features/orgs/components/billing/BillingUsage/utils/previousBillingCycleStart';
import { startOfUtcDay } from '@/features/orgs/components/billing/BillingUsage/utils/startOfUtcDay';

const PRESET_DAYS: Record<
  Exclude<
    BillingUsageRangePreset,
    'currentBillingCycle' | 'previousBillingCycle'
  >,
  number
> = {
  '7d': 7,
  '30d': 30,
  '60d': 60,
};

export default function resolveBillingUsageTimeRange(
  range: BillingUsageTimeRange,
  bounds: BillingUsageRangeBounds,
): ResolvedBillingUsageTimeRange {
  const min = new Date(bounds.min);
  const max = new Date(bounds.max);

  if (range.kind === 'absolute') {
    return { from: new Date(range.from), to: new Date(range.to) };
  }

  // When the latest report predates a billing cycle, both cycle presets
  // resolve to an empty range at the cycle's start instead of a reversed one.
  if (range.preset === 'currentBillingCycle') {
    const from = Math.max(
      min.getTime(),
      new Date(bounds.currentBillingCycleStart).getTime(),
    );
    return {
      from: new Date(from),
      to: new Date(Math.max(from, max.getTime())),
    };
  }

  // The previous cycle is clipped to the retained reports: after two 31-day
  // months its first day or two fall outside the 60-day window.
  if (range.preset === 'previousBillingCycle') {
    const cycleEnd = new Date(bounds.currentBillingCycleStart).getTime();
    const from = Math.max(
      min.getTime(),
      previousBillingCycleStart(bounds.currentBillingCycleStart),
    );
    return {
      from: new Date(from),
      to: new Date(Math.max(from, Math.min(max.getTime(), cycleEnd - 1))),
    };
  }

  const days = PRESET_DAYS[range.preset];
  const firstDay = startOfUtcDay(max.getTime()) - (days - 1) * DAY_MS;
  return {
    from: new Date(Math.max(min.getTime(), firstDay)),
    to: max,
  };
}
