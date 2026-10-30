import toBillingUsageTimeAxis from './toBillingUsageTimeAxis';

const CYCLE_END = '2026-11-01T00:00:00.000Z';

function toIsoAxis(...args: Parameters<typeof toBillingUsageTimeAxis>) {
  const { domain, ticks } = toBillingUsageTimeAxis(...args);
  const iso = (timestamp: number) => new Date(timestamp).toISOString();
  return { domain: domain.map(iso), ticks: ticks.map(iso) };
}

describe('toBillingUsageTimeAxis', () => {
  it("covers the days of the previous billing cycle in the page's time zone", () => {
    const axis = toIsoAxis(
      { kind: 'preset', preset: 'previousBillingCycle' },
      {
        from: new Date('2026-09-01T00:00:00.000Z'),
        to: new Date('2026-10-01T00:00:00.000Z'),
      },
      CYCLE_END,
      'America/Los_Angeles',
    );

    expect(axis.domain).toEqual([
      '2026-09-01T07:00:00.000Z',
      '2026-10-01T07:00:00.000Z',
    ]);
    expect(axis.ticks.at(0)).toBe('2026-09-01T19:00:00.000Z');
    expect(axis.ticks.at(-1)).toBe('2026-09-30T19:00:00.000Z');
  });

  it('labels every day of a short range', () => {
    const axis = toIsoAxis(
      { kind: 'absolute', from: '2026-09-29', to: '2026-10-03' },
      {
        from: new Date('2026-09-29T00:00:00.000Z'),
        to: new Date('2026-10-04T00:00:00.000Z'),
      },
      CYCLE_END,
      'UTC',
    );

    expect(axis.ticks).toEqual([
      '2026-09-29T12:00:00.000Z',
      '2026-09-30T12:00:00.000Z',
      '2026-10-01T12:00:00.000Z',
      '2026-10-02T12:00:00.000Z',
      '2026-10-03T12:00:00.000Z',
    ]);
  });
});
