import { isValid, parseISO } from 'date-fns';
import { useRouter } from 'next/router';
import { useCallback, useMemo } from 'react';
import { DEFAULT_BILLING_USAGE_TIME_RANGE } from '@/features/orgs/components/billing/BillingUsage/constants';
import type {
  BillingUsageTimeRange,
  BillingUsageTimeZone,
} from '@/features/orgs/components/billing/BillingUsage/types';
import { isBillingUsageRangePreset } from '@/features/orgs/components/billing/BillingUsage/utils/isBillingUsageRangePreset';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

const RANGE_KEY = 'usageRange';
const FROM_KEY = 'usageFrom';
const TO_KEY = 'usageTo';
const TIME_ZONE_KEY = 'usageTz';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface BillingUsageTimeRangeUrlState {
  range: BillingUsageTimeRange;
  setRange: (next: BillingUsageTimeRange) => void;
  timeZone: BillingUsageTimeZone;
  setTimeZone: (next: BillingUsageTimeZone) => void;
}

function isValidDate(value: string): boolean {
  return DATE_PATTERN.test(value) && isValid(parseISO(value));
}

// Browser time is the default, so only UTC is kept in the URL.
export default function useBillingUsageTimeRangeUrlState(): BillingUsageTimeRangeUrlState {
  const router = useRouter();
  // Read each relevant key individually so unrelated URL changes (e.g. switching
  // tabs) don't churn `range`'s identity.
  const rangeParam = getSingleQueryParam(router.query[RANGE_KEY]);
  const fromParam = getSingleQueryParam(router.query[FROM_KEY]);
  const toParam = getSingleQueryParam(router.query[TO_KEY]);
  const timeZone: BillingUsageTimeZone =
    getSingleQueryParam(router.query[TIME_ZONE_KEY]) === 'utc'
      ? 'utc'
      : 'browser';

  const range = useMemo<BillingUsageTimeRange>(() => {
    if (rangeParam && isBillingUsageRangePreset(rangeParam)) {
      return { kind: 'preset', preset: rangeParam };
    }
    if (
      fromParam &&
      toParam &&
      isValidDate(fromParam) &&
      isValidDate(toParam)
    ) {
      return { kind: 'absolute', from: fromParam, to: toParam };
    }
    return DEFAULT_BILLING_USAGE_TIME_RANGE;
  }, [rangeParam, fromParam, toParam]);

  const replaceQuery = useCallback(
    (query: typeof router.query) => {
      router.replace({ pathname: router.pathname, query }, undefined, {
        shallow: true,
        scroll: false,
      });
    },
    [router],
  );

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
      replaceQuery(query);
    },
    [replaceQuery, router.query],
  );

  const setTimeZone = useCallback(
    (next: BillingUsageTimeZone) => {
      const query = { ...router.query };
      delete query[TIME_ZONE_KEY];
      if (next === 'utc') {
        query[TIME_ZONE_KEY] = 'utc';
      }
      replaceQuery(query);
    },
    [replaceQuery, router.query],
  );

  return { range, setRange, timeZone, setTimeZone };
}
