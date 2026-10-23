import { DAY_MS } from '@/features/orgs/components/billing/BillingUsage/constants';
import type {
  BillingUsageTimeAxis,
  BillingUsageTimeRange,
  ResolvedBillingUsageTimeRange,
} from '@/features/orgs/components/billing/BillingUsage/types';
import { startOfUtcDay } from '@/features/orgs/components/billing/BillingUsage/utils/startOfUtcDay';

const INVOICE_MARKER_PADDING_DAYS = 2;
const MIN_END_TICK_GAP_DAYS = 3;

// Bars are centred on their UTC day, so the domain extends half a day past
// the first and last ticks; otherwise the outermost bars are half clipped
// behind the axes.
export default function toBillingUsageTimeAxis(
  range: BillingUsageTimeRange,
  resolved: ResolvedBillingUsageTimeRange,
  currentBillingCycleEnd: string,
): BillingUsageTimeAxis {
  const firstDay = startOfUtcDay(resolved.from.getTime());
  const lastTick =
    range.kind === 'preset' && range.preset === 'currentBillingCycle'
      ? new Date(currentBillingCycleEnd).getTime() +
        INVOICE_MARKER_PADDING_DAYS * DAY_MS
      : startOfUtcDay(resolved.to.getTime());

  return {
    domain: [firstDay - DAY_MS / 2, lastTick + DAY_MS / 2],
    ticks: createWeeklyTicks(firstDay, lastTick),
  };
}

function createWeeklyTicks(firstTick: number, lastTick: number): number[] {
  const ticks: number[] = [];
  for (
    let timestamp = firstTick;
    timestamp < lastTick;
    timestamp += 7 * DAY_MS
  ) {
    ticks.push(timestamp);
  }
  const lastWeeklyTick = ticks[ticks.length - 1];
  if (
    ticks.length > 1 &&
    lastTick - lastWeeklyTick < MIN_END_TICK_GAP_DAYS * DAY_MS
  ) {
    ticks.pop();
  }
  ticks.push(lastTick);
  return ticks;
}
