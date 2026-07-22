import serializeTemporalValue from './serializeTemporalValue';

describe('serializeTemporalValue', () => {
  it('passes non-Date values through unchanged', () => {
    expect(serializeTemporalValue('1 day', 'interval')).toBe('1 day');
    expect(serializeTemporalValue('10:30', 'time without time zone')).toBe(
      '10:30',
    );
    expect(serializeTemporalValue('hello', 'text')).toBe('hello');
    expect(serializeTemporalValue(null, 'date')).toBe(null);
    expect(
      serializeTemporalValue(undefined, 'timestamp with time zone'),
    ).toBeUndefined();
  });

  it('formats a date as local yyyy-MM-dd without shifting the day', () => {
    const localMidnight = new Date(2024, 0, 15, 0, 0, 0);

    expect(serializeTemporalValue(localMidnight, 'date')).toBe('2024-01-15');
  });

  it('keeps the local wall-clock for timestamp without time zone', () => {
    const local = new Date(2024, 0, 15, 10, 30, 0);

    expect(serializeTemporalValue(local, 'timestamp without time zone')).toBe(
      '2024-01-15T10:30:00',
    );
  });

  it('serializes timestamp with time zone as the UTC instant', () => {
    const local = new Date(2024, 0, 15, 10, 30, 0);

    expect(serializeTemporalValue(local, 'timestamp with time zone')).toBe(
      local.toISOString(),
    );
  });
});
