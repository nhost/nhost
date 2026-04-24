import normalizeDefaultValue from './normalizeDefaultValue';

it('should return null if no default value', () => {
  expect(normalizeDefaultValue(null)).toBeNull();
  expect(normalizeDefaultValue('')).toBeNull();
});

it('should not change default value that is a plain string', () => {
  expect(normalizeDefaultValue('test')).toEqual({
    value: 'test',
    custom: false,
  });
});

it('should preserve empty-string casts so the form can pre-select them', () => {
  expect(normalizeDefaultValue("''::text")).toEqual({
    value: "''::text",
    custom: false,
  });

  expect(normalizeDefaultValue("''::character varying")).toEqual({
    value: "''::character varying",
    custom: false,
  });
});

it('should remove apostrophes and type definition from default value', () => {
  expect(normalizeDefaultValue("'Test Value'::text")).toEqual({
    value: 'Test Value',
    custom: true,
  });

  expect(normalizeDefaultValue("'Test Value'::character varying")).toEqual({
    value: 'Test Value',
    custom: true,
  });

  expect(normalizeDefaultValue("'3'::int4")).toEqual({
    value: '3',
    custom: true,
  });
});

it('should remove arguments from default value function string if enabled', () => {
  expect(
    normalizeDefaultValue("nextval('test_table_seq')", { removeArgs: true }),
  ).toEqual({
    value: 'nextval()',
    custom: false,
  });

  expect(
    normalizeDefaultValue("function('args', 'args')", { removeArgs: true }),
  ).toEqual({
    value: 'function()',
    custom: false,
  });
});
