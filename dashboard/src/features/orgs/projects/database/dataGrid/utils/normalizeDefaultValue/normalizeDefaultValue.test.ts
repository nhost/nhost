import { expect, test } from 'vitest';
import normalizeDefaultValue from './normalizeDefaultValue';

test('should return empty string if no default value', () => {
  expect(normalizeDefaultValue(null)).toMatchObject({
    normalizedDefaultValue: '',
    custom: false,
  });
  expect(normalizeDefaultValue('')).toMatchObject({
    normalizedDefaultValue: '',
    custom: false,
  });
});

test('should not change default value that is a plain string', () => {
  expect(normalizeDefaultValue('test')).toMatchObject({
    normalizedDefaultValue: 'test',
    custom: false,
  });
});

test('should remove apostrophes and type definition from default value', () => {
  expect(normalizeDefaultValue("''::text")).toMatchObject({
    normalizedDefaultValue: '',
    custom: true,
  });

  expect(normalizeDefaultValue("''::character varying")).toMatchObject({
    normalizedDefaultValue: '',
    custom: true,
  });

  expect(normalizeDefaultValue("'Test Value'::text")).toMatchObject({
    normalizedDefaultValue: 'Test Value',
    custom: true,
  });

  expect(
    normalizeDefaultValue("'Test Value'::character varying"),
  ).toMatchObject({
    normalizedDefaultValue: 'Test Value',
    custom: true,
  });

  expect(normalizeDefaultValue("'3'::int4")).toMatchObject({
    normalizedDefaultValue: '3',
    custom: true,
  });
});

test('should remove arguments from default value function string if enabled', () => {
  expect(
    normalizeDefaultValue("nextval('test_table_seq')", { removeArgs: true }),
  ).toMatchObject({
    normalizedDefaultValue: 'nextval()',
    custom: false,
  });

  expect(
    normalizeDefaultValue("function('args', 'args')", { removeArgs: true }),
  ).toMatchObject({
    normalizedDefaultValue: 'function()',
    custom: false,
  });
});
