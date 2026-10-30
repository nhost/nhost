import { tz } from '@date-fns/tz';
import { addDays, subDays } from 'date-fns';
import type {
  BillingUsagePeriod,
  BillingUsageReport,
} from '@/features/orgs/components/billing/BillingUsage/types';
import { toBillingUsageBucket } from '@/features/orgs/components/billing/BillingUsage/utils/toBillingUsageBucket';

// The period covers whole days in the page's time zone, from the bucket that
// holds the earliest report to the one that holds the latest, so every report
// lands in a bucket.
export default function getBillingUsagePeriod(
  reports: BillingUsageReport[],
  days: number,
  timeZone: string,
  currentBillingCycleEnd: string,
): BillingUsagePeriod | undefined {
  if (reports.length === 0) {
    return undefined;
  }
  let earliestReportEnd = Number.POSITIVE_INFINITY;
  let latestReportEnd = 0;
  reports.forEach((report) => {
    const reportEnd = new Date(report.reportEnds).getTime();
    earliestReportEnd = Math.min(earliestReportEnd, reportEnd);
    latestReportEnd = Math.max(latestReportEnd, reportEnd);
  });

  const inZone = { in: tz(timeZone) };
  const bucketDayOf = (instant: number) =>
    toBucketDay(instant, timeZone, currentBillingCycleEnd);
  const periodEnd = addDays(bucketDayOf(latestReportEnd), 1, inZone);
  const periodStart = Math.max(
    subDays(periodEnd, days, inZone).getTime(),
    bucketDayOf(earliestReportEnd),
  );

  return {
    periodStart: new Date(periodStart).toISOString(),
    periodEnd: new Date(periodEnd.getTime()).toISOString(),
  };
}

// The day whose bucket holds the instant. A billing cycle that starts during a
// day moves the edge between two buckets from midnight to the cycle's start,
// so an instant can belong to the day before or after its own.
function toBucketDay(
  instant: number,
  timeZone: string,
  currentBillingCycleEnd: string,
): number {
  const inZone = { in: tz(timeZone) };
  const bucket = toBillingUsageBucket(
    instant,
    timeZone,
    currentBillingCycleEnd,
  );
  if (instant >= bucket.end) {
    return addDays(bucket.day, 1, inZone).getTime();
  }
  if (instant < bucket.start) {
    return subDays(bucket.day, 1, inZone).getTime();
  }
  return bucket.day;
}
