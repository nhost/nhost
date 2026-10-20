import findTextMatches from './findTextMatches';

const SDL = `type Query {
  users: [users!]!
}

type users {
  id: ID!
}`;

describe('findTextMatches', () => {
  it('returns the position of every occurrence', () => {
    expect(findTextMatches('a users b users', 'users')).toEqual([
      { from: 2, to: 7 },
      { from: 10, to: 15 },
    ]);
  });

  it('finds every occurrence across lines', () => {
    const matches = findTextMatches(SDL, 'users');

    expect(matches).toHaveLength(3);
    expect(matches.map(({ from, to }) => SDL.slice(from, to))).toEqual([
      'users',
      'users',
      'users',
    ]);
  });

  it('matches case-insensitively and keeps the positions of the original text', () => {
    const matches = findTextMatches(SDL, 'QUERY');

    expect(matches).toHaveLength(1);
    expect(SDL.slice(matches[0].from, matches[0].to)).toBe('Query');
  });

  it('keeps the positions after characters whose lowercase form is longer', () => {
    const text = '"İstanbul" users';
    const matches = findTextMatches(text, 'users');

    expect(matches).toHaveLength(1);
    expect(text.slice(matches[0].from, matches[0].to)).toBe('users');
  });

  it('treats regular expression characters literally', () => {
    expect(findTextMatches('[users!]! users', '[users!]')).toEqual([
      { from: 0, to: 8 },
    ]);
    expect(findTextMatches('users', '.*')).toEqual([]);
  });

  it('returns no matches when the term is not in the text', () => {
    expect(findTextMatches(SDL, 'posts')).toEqual([]);
  });

  it('does not count overlapping matches', () => {
    expect(findTextMatches('aaaa', 'aa')).toEqual([
      { from: 0, to: 2 },
      { from: 2, to: 4 },
    ]);
    expect(findTextMatches('aaa', 'aa')).toEqual([{ from: 0, to: 2 }]);
  });

  it('returns no matches for an empty term', () => {
    expect(findTextMatches(SDL, '')).toEqual([]);
  });

  it('returns no matches in an empty text', () => {
    expect(findTextMatches('', 'users')).toEqual([]);
  });
});
