import formatPresetForInput from './formatPresetForInput';

describe('formatPresetForInput', () => {
  it('undefined and null both render as empty string', () => {
    expect(formatPresetForInput(undefined)).toBe('');
    expect(formatPresetForInput(null)).toBe('');
  });

  it('booleans render as their string form', () => {
    expect(formatPresetForInput(true)).toBe('true');
    expect(formatPresetForInput(false)).toBe('false');
  });

  it('numbers render as their string form', () => {
    expect(formatPresetForInput(0)).toBe('0');
    expect(formatPresetForInput(5431)).toBe('5431');
    expect(formatPresetForInput(3.14)).toBe('3.14');
  });

  it('strings pass through unchanged', () => {
    expect(formatPresetForInput('')).toBe('');
    expect(formatPresetForInput('hello')).toBe('hello');
    expect(formatPresetForInput('X-Hasura-User-Id')).toBe('X-Hasura-User-Id');
  });

  it('objects render as JSON (avoids "[object Object]")', () => {
    expect(formatPresetForInput({})).toBe('{}');
    expect(formatPresetForInput({ a: 1, b: 'x' })).toBe('{"a":1,"b":"x"}');
    expect(formatPresetForInput([1, 2])).toBe('[1,2]');
  });
});
