import { DAY_MS } from '@/features/orgs/components/billing/BillingUsage/constants';
import type {
  BillingUsagePeriod,
  BillingUsageReport,
} from '@/features/orgs/components/billing/BillingUsage/types';
import { startOfUtcDay } from '@/features/orgs/components/billing/BillingUsage/utils/startOfUtcDay';

export default function getBillingUsagePeriod(
  reports: BillingUsageReport[],
  days: number,
): BillingUsagePeriod | undefined {
  if (reports.length === 0) {
    return undefined;
  }
  const latestReportEnd = reports.reduce(
    (latest, report) => Math.max(latest, new Date(report.reportEnds).getTime()),
    0,
  );

  const periodEnd = startOfUtcDay(latestReportEnd) + DAY_MS;
  const periodStart = periodEnd - days * DAY_MS;

  return {
    periodStart: new Date(periodStart).toISOString(),
    periodEnd: new Date(periodEnd).toISOString(),
    latestReportEnd: new Date(latestReportEnd).toISOString(),
  };
}
