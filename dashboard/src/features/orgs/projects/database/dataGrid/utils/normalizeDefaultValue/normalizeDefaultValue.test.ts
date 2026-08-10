import normalizeDefaultValue from './normalizeDefaultValue';

it('should return null if no default value', () => {
  expect(normalizeDefaultValue(null)).toBeNull();
  expect(normalizeDefaultValue('')).toBeNull();
});

it('should keep a plain string verbatim', () => {
  expect(normalizeDefaultValue('test')).toBe('test');
});

it('should keep functions and expressions verbatim', () => {
  expect(normalizeDefaultValue('gen_random_uuid()')).toBe('gen_random_uuid()');
  expect(normalizeDefaultValue('now()')).toBe('now()');
  expect(normalizeDefaultValue("nextval('test_table_seq')")).toBe(
    "nextval('test_table_seq')",
  );
});

it('should strip a trailing ::type cast but keep the quotes', () => {
  expect(normalizeDefaultValue("'Test Value'::text")).toBe("'Test Value'");
  expect(normalizeDefaultValue("'Test Value'::character varying")).toBe(
    "'Test Value'",
  );
  expect(normalizeDefaultValue("'3'::int4")).toBe("'3'");
});

it('should strip the cast from an empty-string literal', () => {
  expect(normalizeDefaultValue("''::text")).toBe("''");
  expect(normalizeDefaultValue("''::character varying")).toBe("''");
});

it('should only strip the outermost cast and preserve escaped quotes', () => {
  expect(normalizeDefaultValue("'a::b'::text")).toBe("'a::b'");
  expect(normalizeDefaultValue("'O''Brien'::text")).toBe("'O''Brien'");
});

it('should keep a quoted literal without a cast verbatim', () => {
  expect(normalizeDefaultValue("'already quoted'")).toBe("'already quoted'");
});
