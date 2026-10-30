import { tz } from '@date-fns/tz';
import { addDays, parseISO, subDays, subMonths } from 'date-fns';
import type {
  BillingUsageRangeBounds,
  BillingUsageRangePreset,
  BillingUsageTimeRange,
  ResolvedBillingUsageTimeRange,
} from '@/features/orgs/components/billing/BillingUsage/types';

const UTC = { in: tz('UTC') };

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
  timeZone: string,
): ResolvedBillingUsageTimeRange {
  const inZone = { in: tz(timeZone) };
  const min = new Date(bounds.min).getTime();
  const max = new Date(bounds.max).getTime();
  const cycleStart = new Date(bounds.currentBillingCycle.start).getTime();

  if (range.kind === 'absolute') {
    const from = parseISO(range.from, inZone);
    const to = addDays(parseISO(range.to, inZone), 1, inZone);
    return { from: new Date(from.getTime()), to: new Date(to.getTime()) };
  }

  if (range.preset === 'currentBillingCycle') {
    const from = Math.max(min, cycleStart);
    return { from: new Date(from), to: new Date(Math.max(from, max)) };
  }

  if (range.preset === 'previousBillingCycle') {
    const previousCycleStart = subMonths(
      bounds.currentBillingCycle.end,
      2,
      UTC,
    ).getTime();
    const from = Math.max(min, previousCycleStart);
    return {
      from: new Date(from),
      to: new Date(Math.max(from, Math.min(max, cycleStart))),
    };
  }

  const from = subDays(max, PRESET_DAYS[range.preset], inZone).getTime();
  return { from: new Date(Math.max(min, from)), to: new Date(max) };
}
