import toBillingUsageTimeAxis from './toBillingUsageTimeAxis';

describe('toBillingUsageTimeAxis', () => {
  it('ends a previous billing cycle axis on the last day of the cycle', () => {
    const axis = toBillingUsageTimeAxis(
      { kind: 'preset', preset: 'previousBillingCycle' },
      {
        from: new Date('2026-09-01T00:00:00.000Z'),
        to: new Date('2026-09-30T23:59:59.999Z'),
      },
      '2026-11-01T00:00:00.000Z',
    );

    expect(axis.ticks[0]).toBe(Date.UTC(2026, 8, 1));
    expect(axis.ticks[axis.ticks.length - 1]).toBe(Date.UTC(2026, 8, 30));
  });
});
