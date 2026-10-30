import { tz } from '@date-fns/tz';
import { format, startOfMonth } from 'date-fns';
import type {
  BillingUsageRangeBounds,
  BillingUsageRangePreset,
} from '@/features/orgs/components/billing/BillingUsage/types';
import { getBillingUsagePresetCycle } from '@/features/orgs/components/billing/BillingUsage/utils/getBillingUsagePresetCycle';

const UTC = { in: tz('UTC') };

// Names the cycle a billing-cycle preset covers: its UTC month, e.g.
// "Sep 2026", when it starts with one, or else its UTC days, e.g.
// "Sep 30 – Oct 30". A cycle older reports no longer cover starts at its
// first day with reports, in the page's time zone: "Sep 3 – Oct 1 (partial)".
export default function getBillingUsagePresetCycleLabel(
  preset: BillingUsageRangePreset,
  bounds: BillingUsageRangeBounds,
  timeZone: string,
): string | undefined {
  const cycle = getBillingUsagePresetCycle(preset, bounds);
  if (!cycle) {
    return undefined;
  }
  if (cycle.isPartial) {
    const firstDay = format(bounds.min, 'MMM d', { in: tz(timeZone) });
    return `${firstDay} – ${format(cycle.end, 'MMM d', UTC)} (partial)`;
  }
  if (startOfMonth(cycle.start, UTC).getTime() === cycle.start) {
    return format(cycle.start, 'MMM yyyy', UTC);
  }
  return `${format(cycle.start, 'MMM d', UTC)} – ${format(cycle.end, 'MMM d', UTC)}`;
}
