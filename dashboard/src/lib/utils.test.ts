import { isEmptyValue } from './utils';

test('returns true when the value is undefined or "undefined"', () => {
  expect(isEmptyValue(undefined)).toBe(true)
  expect(isEmptyValue('undefined')).toBe(true)
})

test('returns true when the value is null or "null"', () => {
  expect(isEmptyValue(null)).toBe(true)
  expect(isEmptyValue('null')).toBe(true)
})

test('returns true when the value is an empty string', () => {
  expect(isEmptyValue('')).toBe(true)
})

test('returns true when the value is "NaN" or not a number', () => {
  expect(isEmptyValue("NaN")).toBe(true)
  expect(isEmptyValue(NaN)).toBe(true)
})

test('returns true when the value is an empty object or array', () => {
  expect(isEmptyValue({})).toBe(true)
  expect(isEmptyValue([])).toBe(true)
})

test('returns false when the value is has at least one property or the array has at least on item in it', () => {
  expect(isEmptyValue({foo: 'Bar'})).toBe(false)
  expect(isEmptyValue(['foo', 'bar'])).toBe(false)
})

test('returns false when the value is either a number or string', () => {
  expect(isEmptyValue(1234)).toBe(false)
  expect(isEmptyValue('Hello there')).toBe(false)
})