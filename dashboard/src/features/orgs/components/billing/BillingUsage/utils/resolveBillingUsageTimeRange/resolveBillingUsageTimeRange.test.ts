import resolveBillingUsageTimeRange from './resolveBillingUsageTimeRange';

const PREVIOUS_CYCLE = {
  kind: 'preset',
  preset: 'previousBillingCycle',
} as const;

function resolve(...args: Parameters<typeof resolveBillingUsageTimeRange>) {
  const { from, to } = resolveBillingUsageTimeRange(...args);
  return [from.toISOString(), to.toISOString()];
}

describe('resolveBillingUsageTimeRange', () => {
  it('covers the previous billing cycle exactly outside UTC', () => {
    expect(
      resolve(
        PREVIOUS_CYCLE,
        {
          min: '2026-08-07T07:00:00.000Z',
          max: '2026-10-06T07:00:00.000Z',
          currentBillingCycle: {
            start: '2026-10-01T00:00:00.000Z',
            end: '2026-11-01T00:00:00.000Z',
          },
        },
        'America/Los_Angeles',
      ),
    ).toEqual(['2026-09-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z']);
  });

  it('clips the previous billing cycle to the retained reports', () => {
    expect(
      resolve(
        PREVIOUS_CYCLE,
        {
          min: '2026-07-03T00:00:00.000Z',
          max: '2026-09-01T00:00:00.000Z',
          currentBillingCycle: {
            start: '2026-08-01T00:00:00.000Z',
            end: '2026-09-01T00:00:00.000Z',
          },
        },
        'UTC',
      ),
    ).toEqual(['2026-07-03T00:00:00.000Z', '2026-08-01T00:00:00.000Z']);
  });

  it("covers whole days of a custom range in the page's time zone", () => {
    expect(
      resolve(
        { kind: 'absolute', from: '2026-09-02', to: '2026-09-08' },
        {
          min: '2026-08-07T00:00:00.000Z',
          max: '2026-10-06T00:00:00.000Z',
          currentBillingCycle: {
            start: '2026-10-01T00:00:00.000Z',
            end: '2026-11-01T00:00:00.000Z',
          },
        },
        'America/Los_Angeles',
      ),
    ).toEqual(['2026-09-02T07:00:00.000Z', '2026-09-09T07:00:00.000Z']);
  });
});
