import unwrapType from './unwrapType';

describe('unwrapType', () => {
  it('unwraps a plain type', () => {
    expect(unwrapType('SampleInput')).toEqual({
      typename: 'SampleInput',
      stack: [],
    });
  });

  it('unwraps a non-nullable list of non-nullable types', () => {
    expect(unwrapType('[SampleInput!]!')).toEqual({
      typename: 'SampleInput',
      stack: ['n', 'l', 'n'],
    });
  });

  it('unwraps a nested list', () => {
    expect(unwrapType('[[SampleInput]]')).toEqual({
      typename: 'SampleInput',
      stack: ['l', 'l'],
    });
  });
});
