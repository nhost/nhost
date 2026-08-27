import { useCallback, useMemo, useState } from 'react';
import { createMockBillingMetrics } from '@/features/orgs/components/billing/BillingMetricsPreview/createMockBillingMetrics';
import type { BillingMetricsData } from '@/features/orgs/components/billing/BillingMetricsPreview/types';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';

export interface UseBillingMetricsResult {
  data: BillingMetricsData;
  loading: false;
  error: null;
  refetch: VoidFunction;
}

export default function useBillingMetrics(): UseBillingMetricsResult {
  const { org } = useCurrentOrg();
  const apps = org?.apps;
  const [now, setNow] = useState(() => new Date());

  const data = useMemo(
    () =>
      createMockBillingMetrics({
        projects: (apps ?? []).map((app) => ({ id: app.id, name: app.name })),
        now,
      }),
    [apps, now],
  );
  const refetch = useCallback(() => setNow(new Date()), []);

  return { data, loading: false, error: null, refetch };
}
