import { tz } from '@date-fns/tz';
import { subMonths } from 'date-fns';
import type {
  BillingUsageRangeBounds,
  BillingUsageRangePreset,
} from '@/features/orgs/components/billing/BillingUsage/types';

const UTC = { in: tz('UTC') };

export interface BillingUsagePresetCycle {
  start: number;
  end: number;
  isPartial: boolean;
  hasReports: boolean;
}

export default function getBillingUsagePresetCycle(
  preset: BillingUsageRangePreset,
  bounds: BillingUsageRangeBounds,
): BillingUsagePresetCycle | undefined {
  const { start, end } = bounds.currentBillingCycle;
  const currentStart = new Date(start).getTime();
  switch (preset) {
    case 'currentBillingCycle':
      return {
        start: currentStart,
        end: new Date(end).getTime(),
        isPartial: false,
        hasReports: true,
      };
    case 'previousBillingCycle': {
      const previousStart = subMonths(end, 2, UTC).getTime();
      const firstDay = new Date(bounds.min).getTime();
      return {
        start: previousStart,
        end: currentStart,
        isPartial: previousStart < firstDay && currentStart > firstDay,
        hasReports: currentStart > firstDay,
      };
    }
    default:
      return undefined;
  }
}
