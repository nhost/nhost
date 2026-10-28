import { groupHistory, withoutDuplicateRuns } from './groupHistory';

const users = { query: 'query Users { users { id } }', variables: '' };
const files = { query: '{ files { id } }', variables: '{"limit":3}' };

describe('groupHistory', () => {
  it('shows a query run twice once, newest first', () => {
    const { recent } = groupHistory([
      users,
      files,
      { ...users, query: `${users.query}\n` },
    ]);

    expect(recent.map((entry) => entry.item.query?.trim())).toEqual([
      users.query,
      files.query,
    ]);
    expect(recent[0].copies).toHaveLength(2);
  });

  it('treats different variables as different runs', () => {
    const { recent } = groupHistory([files, { ...files, variables: '{}' }]);

    expect(recent).toHaveLength(2);
  });

  it("doesn't repeat a starred query under recent", () => {
    const { starred, recent } = groupHistory([
      { ...users, favorite: true },
      users,
      files,
    ]);

    expect(starred).toHaveLength(1);
    expect(recent.map((entry) => entry.item.query)).toEqual([files.query]);
  });
});

describe('withoutDuplicateRuns', () => {
  it('keeps the newest copy in the newest position', () => {
    expect(withoutDuplicateRuns([users, files, users])).toEqual([files, users]);
  });
});
