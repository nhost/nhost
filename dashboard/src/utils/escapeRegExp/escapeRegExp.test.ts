import escapeRegExp from './escapeRegExp';

describe('escapeRegExp', () => {
  it('escapes every regular expression special character', () => {
    expect(escapeRegExp('.*+?^{}$()|[]\\')).toBe(
      '\\.\\*\\+\\?\\^\\{\\}\\$\\(\\)\\|\\[\\]\\\\',
    );
  });

  it('leaves other characters unchanged', () => {
    expect(escapeRegExp('users_by_pk!')).toBe('users_by_pk!');
  });

  it('makes a regular expression match the input literally', () => {
    const regex = new RegExp(escapeRegExp('[users!]'));

    expect(regex.test('[users!]!')).toBe(true);
    expect(regex.test('users')).toBe(false);
  });
});
