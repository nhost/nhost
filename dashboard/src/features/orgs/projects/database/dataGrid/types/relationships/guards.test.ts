import { isFKConstraintOnSameTable } from '@/features/orgs/projects/database/dataGrid/types/relationships/guards';
import type { ForeignKeyConstraintOn } from '@/utils/hasura-api/generated/schemas';

describe('isFKConstraintOnSameTable', () => {
  it.each([
    ['one column', 'author_id'],
    ['composite columns', ['tenant_id', 'order_id']],
  ] satisfies [string, ForeignKeyConstraintOn][])(
    'accepts a same table constraint with %s',
    (_name, constraint) => {
      expect(isFKConstraintOnSameTable(constraint)).toBe(true);
    },
  );

  it.each([
    ['one column', { table: { schema: 'public', name: 'posts' }, column: 'a' }],
    [
      'composite columns',
      { table: { schema: 'public', name: 'posts' }, columns: ['a', 'b'] },
    ],
  ] satisfies [string, ForeignKeyConstraintOn][])(
    'rejects a remote table constraint with %s',
    (_name, constraint) => {
      expect(isFKConstraintOnSameTable(constraint)).toBe(false);
    },
  );

  it('rejects an undefined constraint', () => {
    expect(isFKConstraintOnSameTable(undefined)).toBe(false);
  });
});
