import getBaseType from './getBaseType';

it('returns an empty string for empty, null or undefined input', () => {
  expect(getBaseType(undefined)).toBe('');
  expect(getBaseType(null)).toBe('');
  expect(getBaseType('')).toBe('');
});

it('passes a bare type through unchanged', () => {
  expect(getBaseType('integer')).toBe('integer');
  expect(getBaseType('text')).toBe('text');
  expect(getBaseType('timestamp with time zone')).toBe(
    'timestamp with time zone',
  );
});

it('strips length and precision modifiers', () => {
  expect(getBaseType('character varying(12)')).toBe('character varying');
  expect(getBaseType('numeric(10,2)')).toBe('numeric');
});

it('strips modifiers that appear in the middle of the name', () => {
  expect(getBaseType('timestamp(3) with time zone')).toBe(
    'timestamp with time zone',
  );
  expect(getBaseType('time(6) without time zone')).toBe(
    'time without time zone',
  );
});

it('strips a trailing array marker', () => {
  expect(getBaseType('integer[]')).toBe('integer');
  expect(getBaseType('text[]')).toBe('text');
});

it('strips array markers and modifiers together', () => {
  expect(getBaseType('character varying(12)[]')).toBe('character varying');
  expect(getBaseType('numeric(10,2)[]')).toBe('numeric');
});

it('leaves custom and schema-qualified type names intact', () => {
  expect(getBaseType('my_enum')).toBe('my_enum');
  expect(getBaseType('public.my_status')).toBe('public.my_status');
});

it('preserves parentheses inside double-quoted (custom) type names', () => {
  expect(getBaseType('"my(type)"')).toBe('"my(type)"');
  expect(getBaseType('public."my(type)"')).toBe('public."my(type)"');
});

it('strips only a trailing array marker from quoted type names', () => {
  expect(getBaseType('"my(type)"[]')).toBe('"my(type)"');
});

it('preserves internal whitespace in quoted type names', () => {
  expect(getBaseType('"My  Enum"')).toBe('"My  Enum"');
});
