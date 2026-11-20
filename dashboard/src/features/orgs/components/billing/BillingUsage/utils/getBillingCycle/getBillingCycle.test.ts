import getBillingCycle from './getBillingCycle';

function cycleHolding(instant: string, currentBillingCycleEnd: string) {
  const { start, end } = getBillingCycle(
    Date.parse(instant),
    currentBillingCycleEnd,
  );
  return {
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
  };
}

describe('getBillingCycle', () => {
  it('finds an earlier cycle from its first instant', () => {
    expect(
      cycleHolding('2026-09-01T00:00:00.000Z', '2026-12-01T00:00:00.000Z'),
    ).toEqual({
      start: '2026-09-01T00:00:00.000Z',
      end: '2026-10-01T00:00:00.000Z',
    });
  });

  it("finds the next cycle from the current one's end", () => {
    expect(
      cycleHolding('2026-12-01T00:00:00.000Z', '2026-12-01T00:00:00.000Z'),
    ).toEqual({
      start: '2026-12-01T00:00:00.000Z',
      end: '2027-01-01T00:00:00.000Z',
    });
  });

  it('finds cycles that renew during a day', () => {
    expect(
      cycleHolding('2026-10-30T22:59:59.999Z', '2026-11-30T23:00:00.000Z'),
    ).toEqual({
      start: '2026-09-30T23:00:00.000Z',
      end: '2026-10-30T23:00:00.000Z',
    });
  });
});
