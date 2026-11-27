import formatArrayValue from './formatArrayValue';

describe('formatArrayValue', () => {
  it.each([
    { value: '["a","b"]', expected: "ARRAY['a','b']" },
    { value: '[1,2,3]', expected: 'ARRAY[1,2,3]' },
    { value: '["it\'s"]', expected: "ARRAY['it''s']" },
    { value: '[]', expected: "'{}'" },
    { value: ' [ ] ', expected: "'{}'" },
  ])('formats $value as $expected', ({ value, expected }) => {
    expect(formatArrayValue('tags', value)).toBe(expected);
  });

  it('names the column when the value is not valid JSON', () => {
    expect(() => formatArrayValue('tags', '{a,b}')).toThrow(
      'Invalid array value for column "tags"',
    );
  });
});
