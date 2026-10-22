import type { BillingUsageReport } from '@/features/orgs/components/billing/BillingUsage/types';
import getBillingUsagePeriod from './getBillingUsagePeriod';

function report(reportEnds: string): BillingUsageReport {
  return {
    projectID: 'alpha',
    projectName: 'Alpha',
    isDeleted: false,
    type: 'egress',
    value: 1,
    reportEnds,
  };
}

describe('getBillingUsagePeriod', () => {
  it('ends the period after the UTC day of the latest report', () => {
    const reports = [
      report('2026-08-07T12:00:00.000Z'),
      report('2026-08-10T08:00:00.000Z'),
      report('2026-08-09T20:00:00.000Z'),
    ];

    expect(getBillingUsagePeriod(reports, 3)).toEqual({
      periodStart: '2026-08-08T00:00:00.000Z',
      periodEnd: '2026-08-11T00:00:00.000Z',
      latestReportEnd: '2026-08-10T08:00:00.000Z',
    });
  });
});
