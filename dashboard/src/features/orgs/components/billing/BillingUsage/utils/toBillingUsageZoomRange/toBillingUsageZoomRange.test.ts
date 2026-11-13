import toBillingUsageZoomRange from './toBillingUsageZoomRange';

const BOUNDS = {
  min: '2026-08-07T00:00:00.000Z',
  max: '2026-10-06T00:00:00.000Z',
  currentBillingCycle: {
    start: '2026-10-01T00:00:00.000Z',
    end: '2026-11-01T00:00:00.000Z',
  },
};

describe('toBillingUsageZoomRange', () => {
  it.each([
    {
      name: 'keeps a selection within the reported days',
      first: '2026-10-02T12:00:00.000Z',
      last: '2026-10-04T12:00:00.000Z',
      timeZone: 'UTC',
      expected: { kind: 'absolute', from: '2026-10-02', to: '2026-10-04' },
    },
    {
      name: 'keeps a selection of a single instant',
      first: '2026-10-02T12:00:00.000Z',
      last: '2026-10-02T12:00:00.000Z',
      timeZone: 'UTC',
      expected: { kind: 'absolute', from: '2026-10-02', to: '2026-10-02' },
    },
    {
      name: 'clips a selection that extends past the latest reported day',
      first: '2026-10-02T12:00:00.000Z',
      last: '2026-10-20T12:00:00.000Z',
      timeZone: 'UTC',
      expected: { kind: 'absolute', from: '2026-10-02', to: '2026-10-05' },
    },
    {
      name: 'clips a selection that starts before the earliest reported day',
      first: '2026-08-01T12:00:00.000Z',
      last: '2026-08-09T12:00:00.000Z',
      timeZone: 'UTC',
      expected: { kind: 'absolute', from: '2026-08-07', to: '2026-08-09' },
    },
    {
      name: 'ignores a selection entirely after the reported days',
      first: '2026-10-15T12:00:00.000Z',
      last: '2026-10-20T12:00:00.000Z',
      timeZone: 'UTC',
      expected: undefined,
    },
    {
      name: 'ignores a selection starting at the exclusive upper bound',
      first: BOUNDS.max,
      last: '2026-10-07T12:00:00.000Z',
      timeZone: 'UTC',
      expected: undefined,
    },
    {
      name: 'ignores a selection entirely before the reported days',
      first: '2026-08-01T12:00:00.000Z',
      last: '2026-08-05T12:00:00.000Z',
      timeZone: 'UTC',
      expected: undefined,
    },
    {
      name: 'uses the selected time zone to name the days',
      first: '2026-10-02T06:30:00.000Z',
      last: '2026-10-04T06:30:00.000Z',
      timeZone: 'America/Los_Angeles',
      expected: { kind: 'absolute', from: '2026-10-01', to: '2026-10-03' },
    },
  ])('$name', ({ first, last, timeZone, expected }) => {
    expect(
      toBillingUsageZoomRange(
        Date.parse(first),
        Date.parse(last),
        BOUNDS,
        timeZone,
      ),
    ).toEqual(expected);
  });
});
