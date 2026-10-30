import validateBillingUsageTimeRange from './validateBillingUsageTimeRange';

// Aug 2 to Sep 30 in UTC.
const BOUNDS = {
  min: '2026-08-02T00:00:00.000Z',
  max: '2026-10-01T00:00:00.000Z',
  currentBillingCycle: {
    start: '2026-10-01T00:00:00.000Z',
    end: '2026-11-01T00:00:00.000Z',
  },
};

const PREVIOUS_CYCLE = {
  kind: 'preset',
  preset: 'previousBillingCycle',
} as const;

describe('validateBillingUsageTimeRange', () => {
  it('accepts the current billing cycle before its first report', () => {
    expect(
      validateBillingUsageTimeRange(
        { kind: 'preset', preset: 'currentBillingCycle' },
        BOUNDS,
        'UTC',
      ),
    ).toBeUndefined();
  });

  it('accepts a previous billing cycle with reports', () => {
    expect(
      validateBillingUsageTimeRange(PREVIOUS_CYCLE, BOUNDS, 'UTC'),
    ).toBeUndefined();
  });

  it('rejects a previous billing cycle without reports', () => {
    expect(
      validateBillingUsageTimeRange(
        PREVIOUS_CYCLE,
        { ...BOUNDS, min: '2026-10-05T00:00:00.000Z' },
        'UTC',
      ),
    ).toBe('There are no usage reports for the previous billing cycle.');
  });

  it('accepts days within the retained reports', () => {
    expect(
      validateBillingUsageTimeRange(
        { kind: 'absolute', from: '2026-08-02', to: '2026-09-30' },
        BOUNDS,
        'UTC',
      ),
    ).toBeUndefined();
  });

  it('rejects days before the first report', () => {
    expect(
      validateBillingUsageTimeRange(
        { kind: 'absolute', from: '2026-08-01', to: '2026-08-10' },
        BOUNDS,
        'UTC',
      ),
    ).toBe('There are no usage reports before Aug 2, 2026.');
  });
});
