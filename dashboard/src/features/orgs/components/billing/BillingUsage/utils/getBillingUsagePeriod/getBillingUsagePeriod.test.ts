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

const REPORTS = [
  report('2026-08-07T12:00:00.000Z'),
  report('2026-08-10T08:00:00.000Z'),
  report('2026-08-09T20:00:00.000Z'),
];

// No billing cycle starts near the reports above.
const CYCLE_END = '2026-09-01T00:00:00.000Z';

describe('getBillingUsagePeriod', () => {
  it('ends the period at the midnight after the latest report', () => {
    expect(getBillingUsagePeriod(REPORTS, 3, 'UTC', CYCLE_END)).toEqual({
      periodStart: '2026-08-08T00:00:00.000Z',
      periodEnd: '2026-08-11T00:00:00.000Z',
    });
  });

  it("uses midnights in the page's time zone", () => {
    expect(
      getBillingUsagePeriod(REPORTS, 3, 'America/Los_Angeles', CYCLE_END),
    ).toEqual({
      periodStart: '2026-08-08T07:00:00.000Z',
      periodEnd: '2026-08-11T07:00:00.000Z',
    });
  });

  it('starts the period at the day of the earliest report when it is more recent', () => {
    expect(getBillingUsagePeriod(REPORTS, 95, 'UTC', CYCLE_END)).toEqual({
      periodStart: '2026-08-07T00:00:00.000Z',
      periodEnd: '2026-08-11T00:00:00.000Z',
    });
  });

  it("ends the period after the next day when the latest report is in a cycle that started late in the report's day", () => {
    // The cycle starts on Nov 30 at 4 PM in Los Angeles, so the rest of that
    // day is in the bucket of Dec 1.
    expect(
      getBillingUsagePeriod(
        [
          report('2026-11-30T20:00:00.000Z'),
          report('2026-12-01T04:00:00.000Z'),
        ],
        95,
        'America/Los_Angeles',
        '2027-01-01T00:00:00.000Z',
      ),
    ).toEqual({
      periodStart: '2026-11-30T08:00:00.000Z',
      periodEnd: '2026-12-02T08:00:00.000Z',
    });
  });

  it("starts the period on the day before when the earliest report is before a cycle that starts early in the report's day", () => {
    // The cycle starts on Oct 1 at 1 AM in London, so the hour before it is in
    // the bucket of Sep 30.
    expect(
      getBillingUsagePeriod(
        [
          report('2026-09-30T23:30:00.000Z'),
          report('2026-10-02T12:00:00.000Z'),
        ],
        95,
        'Europe/London',
        '2026-11-01T00:00:00.000Z',
      ),
    ).toEqual({
      periodStart: '2026-09-29T23:00:00.000Z',
      periodEnd: '2026-10-02T23:00:00.000Z',
    });
  });
});
