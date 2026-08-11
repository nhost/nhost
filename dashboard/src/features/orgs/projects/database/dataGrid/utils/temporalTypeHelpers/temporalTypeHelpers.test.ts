import {
  isDateType,
  isIntervalType,
  isTemporalType,
  isTimestampType,
  isTimeType,
} from './temporalTypeHelpers';

describe('isTimestampType', () => {
  it('matches canonical timestamp base types', () => {
    expect(isTimestampType('timestamp with time zone')).toBe(true);
    expect(isTimestampType('timestamp without time zone')).toBe(true);
  });

  it('does not match short aliases, time, date or non-temporal types', () => {
    expect(isTimestampType('timestamptz')).toBe(false);
    expect(isTimestampType('timestamp')).toBe(false);
    expect(isTimestampType('time with time zone')).toBe(false);
    expect(isTimestampType('date')).toBe(false);
    expect(isTimestampType('text')).toBe(false);
    expect(isTimestampType(undefined)).toBe(false);
  });
});

describe('isTimeType', () => {
  it('matches canonical time-of-day base types', () => {
    expect(isTimeType('time with time zone')).toBe(true);
    expect(isTimeType('time without time zone')).toBe(true);
  });

  it('does not match short aliases or timestamp types', () => {
    expect(isTimeType('timetz')).toBe(false);
    expect(isTimeType('time')).toBe(false);
    expect(isTimeType('timestamp with time zone')).toBe(false);
    expect(isTimeType('timestamptz')).toBe(false);
  });
});

describe('isDateType', () => {
  it('matches only the calendar date type', () => {
    expect(isDateType('date')).toBe(true);
    expect(isDateType('timestamp with time zone')).toBe(false);
    expect(isDateType('interval')).toBe(false);
  });
});

describe('isIntervalType', () => {
  it('matches interval and field-qualified variants', () => {
    expect(isIntervalType('interval')).toBe(true);
    expect(isIntervalType('interval day to second')).toBe(true);
  });

  it('does not match other temporal types', () => {
    expect(isIntervalType('time with time zone')).toBe(false);
    expect(isIntervalType('date')).toBe(false);
  });
});

describe('isTemporalType', () => {
  it('is true for any date/time type', () => {
    expect(isTemporalType('timestamp with time zone')).toBe(true);
    expect(isTemporalType('time with time zone')).toBe(true);
    expect(isTemporalType('date')).toBe(true);
    expect(isTemporalType('interval')).toBe(true);
  });

  it('is false for non-temporal types', () => {
    expect(isTemporalType('text')).toBe(false);
    expect(isTemporalType('integer')).toBe(false);
    expect(isTemporalType('uuid')).toBe(false);
    expect(isTemporalType(undefined)).toBe(false);
  });
});
