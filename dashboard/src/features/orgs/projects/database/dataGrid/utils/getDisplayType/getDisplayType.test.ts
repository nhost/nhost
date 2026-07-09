import getDisplayType from './getDisplayType';

it('returns an empty string for empty, null or undefined input', () => {
  expect(getDisplayType(undefined)).toBe('');
  expect(getDisplayType(null)).toBe('');
  expect(getDisplayType('')).toBe('');
});

it('shortens the verbose multi-word names', () => {
  expect(getDisplayType('timestamp with time zone')).toBe('timestamptz');
  expect(getDisplayType('timestamp without time zone')).toBe('timestamp');
  expect(getDisplayType('time with time zone')).toBe('timetz');
  expect(getDisplayType('time without time zone')).toBe('time');
  expect(getDisplayType('character varying')).toBe('varchar');
});

it('normalizes short udt names to their readable SQL name', () => {
  expect(getDisplayType('int2')).toBe('smallint');
  expect(getDisplayType('int4')).toBe('integer');
  expect(getDisplayType('int8')).toBe('bigint');
  expect(getDisplayType('float4')).toBe('real');
  expect(getDisplayType('bool')).toBe('boolean');
  expect(getDisplayType('bpchar')).toBe('character');
});

it('leaves readable names unchanged', () => {
  expect(getDisplayType('integer')).toBe('integer');
  expect(getDisplayType('numeric')).toBe('numeric');
  expect(getDisplayType('text')).toBe('text');
  expect(getDisplayType('uuid')).toBe('uuid');
  expect(getDisplayType('jsonb')).toBe('jsonb');
  expect(getDisplayType('date')).toBe('date');
  expect(getDisplayType('interval')).toBe('interval');
  expect(getDisplayType('boolean')).toBe('boolean');
});

it('keeps double precision long, from either spelling', () => {
  expect(getDisplayType('double precision')).toBe('double precision');
  expect(getDisplayType('float8')).toBe('double precision');
});

it('preserves length and precision modifiers', () => {
  expect(getDisplayType('character varying(12)')).toBe('varchar(12)');
  expect(getDisplayType('numeric(10,2)')).toBe('numeric(10,2)');
  expect(getDisplayType('character(5)')).toBe('character(5)');
});

it('preserves array suffixes and shortens the element type', () => {
  expect(getDisplayType('integer[]')).toBe('integer[]');
  expect(getDisplayType('timestamp with time zone[]')).toBe('timestamptz[]');
  expect(getDisplayType('character varying(255)[]')).toBe('varchar(255)[]');
});

it('drops fractional-seconds precision on timestamp / time types', () => {
  expect(getDisplayType('timestamp(3) with time zone')).toBe('timestamptz');
  expect(getDisplayType('time(6) without time zone')).toBe('time');
});

it('passes custom, schema-qualified and quoted type names through unchanged', () => {
  expect(getDisplayType('my_enum')).toBe('my_enum');
  expect(getDisplayType('public.my_status')).toBe('public.my_status');
  expect(getDisplayType('"my(type)"')).toBe('"my(type)"');
});
