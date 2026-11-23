import { toBillingUsageBuckets } from '@/features/orgs/components/billing/BillingUsage/utils/toBillingUsageBuckets';
import sliceBillingUsageSeries from './sliceBillingUsageSeries';

// Sep 29 to Oct 2 in Los Angeles. Sep 30 ends at 5 PM and Oct 1 starts then.
const BUCKETS = toBillingUsageBuckets(
  {
    periodStart: '2026-09-29T07:00:00.000Z',
    periodEnd: '2026-10-03T07:00:00.000Z',
  },
  'America/Los_Angeles',
  '2026-11-01T00:00:00.000Z',
);

const SERIES = [
  {
    labels: { projectID: 'alpha' },
    timestamps: BUCKETS.map((bucket) =>
      new Date(bucket.timestamp).toISOString(),
    ),
    datapoints: [1, 2, 3, 4],
  },
];

function sliceDatapoints(from: string, to: string) {
  return sliceBillingUsageSeries(SERIES, BUCKETS, {
    from: new Date(from),
    to: new Date(to),
  })[0].datapoints;
}

describe('sliceBillingUsageSeries', () => {
  it('starts the October cycle with Oct 1', () => {
    expect(
      sliceDatapoints('2026-10-01T00:00:00.000Z', '2026-10-03T07:00:00.000Z'),
    ).toEqual([3, 4]);
  });

  it('ends the September cycle with Sep 30', () => {
    expect(
      sliceDatapoints('2026-09-29T07:00:00.000Z', '2026-10-01T00:00:00.000Z'),
    ).toEqual([1, 2]);
  });

  it('keeps a picked day', () => {
    expect(
      sliceDatapoints('2026-10-01T07:00:00.000Z', '2026-10-02T07:00:00.000Z'),
    ).toEqual([3]);
  });
});
