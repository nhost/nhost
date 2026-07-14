import getInputType from './getInputType';

describe('getInputType', () => {
  it('returns "datetime-local" for canonical timestamp base types', () => {
    expect(getInputType('timestamp without time zone')).toBe('datetime-local');
    expect(getInputType('timestamp with time zone')).toBe('datetime-local');
  });

  it('returns "time" for canonical time-of-day base types', () => {
    expect(getInputType('time without time zone')).toBe('time');
    expect(getInputType('time with time zone')).toBe('time');
  });

  it('returns "date" for the calendar date type', () => {
    expect(getInputType('date')).toBe('date');
  });

  it('returns "number" for numeric types', () => {
    expect(getInputType('integer')).toBe('number');
    expect(getInputType('numeric')).toBe('number');
    expect(getInputType('double precision')).toBe('number');
  });

  it('returns "text" for text, interval and unknown types', () => {
    expect(getInputType('text')).toBe('text');
    expect(getInputType('character varying')).toBe('text');
    expect(getInputType('interval')).toBe('text');
    expect(getInputType('uuid')).toBe('text');
    expect(getInputType(undefined)).toBe('text');
  });
});
