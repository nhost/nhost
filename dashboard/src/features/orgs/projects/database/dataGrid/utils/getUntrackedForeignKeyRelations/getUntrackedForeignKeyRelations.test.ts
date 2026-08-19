import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import getUntrackedForeignKeyRelations from '@/features/orgs/projects/database/dataGrid/utils/getUntrackedForeignKeyRelations/getUntrackedForeignKeyRelations';

function relation(
  overrides: Partial<ForeignKeyRelation> = {},
): ForeignKeyRelation {
  return {
    name: 'user_fkey',
    columns: ['user_id'],
    referencedSchema: 'public',
    referencedTable: 'users',
    referencedColumns: ['id'],
    updateAction: 'CASCADE',
    deleteAction: 'CASCADE',
    oneToOne: false,
    ...overrides,
  };
}

describe('getUntrackedForeignKeyRelations', () => {
  it('returns new and changed singular relations in updated order', () => {
    const original = [
      relation(),
      relation({
        name: 'post_fkey',
        columns: ['post_id'],
        referencedTable: 'posts',
      }),
    ];
    const updated = [
      relation({ referencedTable: 'accounts' }),
      relation({
        name: 'post_fkey',
        columns: ['post_id'],
        referencedTable: 'posts',
      }),
      relation({
        name: 'comment_fkey',
        columns: ['comment_id'],
        referencedTable: 'comments',
      }),
    ];

    expect(
      getUntrackedForeignKeyRelations(original, updated).map(
        ({ columns }) => columns,
      ),
    ).toEqual([['user_id'], ['comment_id']]);
  });

  it('detects every supported singular mapping and action change', () => {
    const original = relation();

    for (const changed of [
      relation({ referencedSchema: 'private' }),
      relation({ referencedTable: 'accounts' }),
      relation({ referencedColumns: ['uuid'] }),
      relation({ updateAction: 'RESTRICT' }),
      relation({ deleteAction: 'SET NULL' }),
      relation({ oneToOne: true }),
    ]) {
      expect(getUntrackedForeignKeyRelations([original], [changed])).toEqual([
        changed,
      ]);
    }
  });

  it('returns empty output for absent or unchanged relations', () => {
    const unchanged = relation();

    expect(getUntrackedForeignKeyRelations()).toEqual([]);
    expect(getUntrackedForeignKeyRelations([unchanged], [])).toEqual([]);
    expect(
      getUntrackedForeignKeyRelations([unchanged], [{ ...unchanged }]),
    ).toEqual([]);
  });

  it('ignores composite relations without truncating them into trackable actions', () => {
    const composite = relation({
      name: 'tenant_user_fkey',
      columns: ['tenant_id', 'user_id'],
      referencedColumns: ['tenant_id', 'id'],
    });

    expect(getUntrackedForeignKeyRelations([], [composite])).toEqual([]);
    expect(
      getUntrackedForeignKeyRelations(
        [composite],
        [{ ...composite, deleteAction: 'RESTRICT' }],
      ),
    ).toEqual([]);
    expect(composite.columns).toEqual(['tenant_id', 'user_id']);
    expect(composite.referencedColumns).toEqual(['tenant_id', 'id']);
  });
});
