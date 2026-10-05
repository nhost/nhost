import { useRouter } from 'next/router';
import { useCallback, useMemo } from 'react';
import {
  type BillingUsageTimeRange,
  DEFAULT_BILLING_USAGE_TIME_RANGE,
  isBillingUsageRangePreset,
} from '@/features/orgs/components/billing/BillingMetricsPreview/utils/billingUsageTimeRange';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

const RANGE_KEY = 'usageRange';
const FROM_KEY = 'usageFrom';
const TO_KEY = 'usageTo';

interface BillingUsageTimeRangeUrlState {
  range: BillingUsageTimeRange;
  setRange: (next: BillingUsageTimeRange) => void;
}

function isValidIso(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

export default function useBillingUsageTimeRangeUrlState(): BillingUsageTimeRangeUrlState {
  const router = useRouter();
  // Read each relevant key individually so unrelated URL changes (e.g. switching
  // tabs) don't churn `range`'s identity.
  const rangeParam = getSingleQueryParam(router.query[RANGE_KEY]);
  const fromParam = getSingleQueryParam(router.query[FROM_KEY]);
  const toParam = getSingleQueryParam(router.query[TO_KEY]);

  const range = useMemo<BillingUsageTimeRange>(() => {
    if (rangeParam && isBillingUsageRangePreset(rangeParam)) {
      return { kind: 'preset', preset: rangeParam };
    }
    if (fromParam && toParam && isValidIso(fromParam) && isValidIso(toParam)) {
      return { kind: 'absolute', from: fromParam, to: toParam };
    }
    return DEFAULT_BILLING_USAGE_TIME_RANGE;
  }, [rangeParam, fromParam, toParam]);

  const setRange = useCallback(
    (next: BillingUsageTimeRange) => {
      const query = { ...router.query };
      delete query[RANGE_KEY];
      delete query[FROM_KEY];
      delete query[TO_KEY];
      if (next.kind === 'preset') {
        query[RANGE_KEY] = next.preset;
      } else {
        query[FROM_KEY] = next.from;
        query[TO_KEY] = next.to;
      }
      router.replace({ pathname: router.pathname, query }, undefined, {
        shallow: true,
        scroll: false,
      });
    },
    [router],
  );

  return { range, setRange };
}
