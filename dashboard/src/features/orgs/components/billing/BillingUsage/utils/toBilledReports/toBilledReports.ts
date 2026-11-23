import type { BillingUsageReport } from '@/features/orgs/components/billing/BillingUsage/types';

const RUN_INTERVAL_MS = 4 * 60 * 60 * 1000;
const RUN_START_SLACK_MS = 15 * 60 * 1000;

export default function toBilledReports(
  reports: BillingUsageReport[],
  now: number,
): BillingUsageReport[] {
  return reports.map((report) => {
    const run =
      Math.ceil(
        (Date.parse(report.reportEnds) - RUN_START_SLACK_MS) / RUN_INTERVAL_MS,
      ) * RUN_INTERVAL_MS;
    return run <= now
      ? { ...report, reportEnds: new Date(run).toISOString() }
      : report;
  });
}
