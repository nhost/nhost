import type { BillingUsageReport } from '@/features/orgs/components/billing/BillingUsage/types';
import toBilledReports from './toBilledReports';

const NOW = Date.parse('2026-10-31T03:00:00.000Z');

function billedAt(reportEnds: string) {
  const report: BillingUsageReport = {
    projectID: 'alpha',
    projectName: 'Alpha',
    isDeleted: false,
    type: 'dedicatedCompute',
    value: 1,
    reportEnds,
  };
  return toBilledReports([report], NOW)[0].reportEnds;
}

describe('toBilledReports', () => {
  it('keeps a report written by a run at that run', () => {
    expect(billedAt('2026-10-30T20:01:00.000Z')).toBe(
      '2026-10-30T20:00:00.000Z',
    );
  });

  it('keeps a report from a run that started late at that run', () => {
    expect(billedAt('2026-10-31T00:07:00.000Z')).toBe(
      '2026-10-31T00:00:00.000Z',
    );
  });

  it('moves a report written between runs to the next run', () => {
    expect(billedAt('2026-10-30T22:28:00.000Z')).toBe(
      '2026-10-31T00:00:00.000Z',
    );
  });

  it('keeps a report whose run has not happened yet', () => {
    expect(billedAt('2026-10-31T02:30:00.000Z')).toBe(
      '2026-10-31T02:30:00.000Z',
    );
  });
});
