import getPostgresFunctionsKey from './getPostgresFunctionsKey';

it('should return an empty string for empty or undefined input', () => {
  expect(getPostgresFunctionsKey(undefined)).toBe('');
  expect(getPostgresFunctionsKey('')).toBe('');
});

it('should pass canonical keys through unchanged', () => {
  expect(getPostgresFunctionsKey('text')).toBe('text');
  expect(getPostgresFunctionsKey('character varying')).toBe(
    'character varying',
  );
});

it('should map aliases to their canonical form', () => {
  expect(getPostgresFunctionsKey('varchar')).toBe('character varying');
});

it('should strip length modifiers from alias and non-alias forms', () => {
  expect(getPostgresFunctionsKey('varchar(10)')).toBe('character varying');
  expect(getPostgresFunctionsKey('character varying(255)')).toBe(
    'character varying',
  );
  expect(getPostgresFunctionsKey('numeric(10, 2)')).toBe('numeric');
});

it('should tolerate whitespace around parentheses', () => {
  expect(getPostgresFunctionsKey('varchar (10)')).toBe('character varying');
  expect(getPostgresFunctionsKey('  numeric(10, 2)  ')).toBe('numeric');
});

it('should pass unknown types through unchanged', () => {
  expect(getPostgresFunctionsKey('mytype')).toBe('mytype');
});

it('should be case-insensitive', () => {
  expect(getPostgresFunctionsKey('VARCHAR')).toBe('character varying');
  expect(getPostgresFunctionsKey('Varchar(10)')).toBe('character varying');
  expect(getPostgresFunctionsKey('TEXT')).toBe('text');
});
