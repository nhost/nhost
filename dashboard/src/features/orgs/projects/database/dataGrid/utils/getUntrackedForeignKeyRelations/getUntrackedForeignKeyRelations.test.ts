import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getUntrackedForeignKeyRelations } from '@/features/orgs/projects/database/dataGrid/utils/getUntrackedForeignKeyRelations';

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

  it('detects every supported singular mapping and cardinality change', () => {
    const original = relation();

    for (const changed of [
      relation({ referencedSchema: 'private' }),
      relation({ referencedTable: 'accounts' }),
      relation({ referencedColumns: ['uuid'] }),
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
    expect(
      getUntrackedForeignKeyRelations(
        [unchanged],
        [
          {
            ...unchanged,
            updateAction: 'RESTRICT',
            deleteAction: 'SET NULL',
          },
        ],
      ),
    ).toEqual([]);
  });

  it('returns new and changed composite relations without truncating pairs', () => {
    const composite = relation({
      name: 'tenant_user_fkey',
      columns: ['tenant_id', 'user_id'],
      referencedColumns: ['tenant_id', 'id'],
    });
    const actionChanged = { ...composite, deleteAction: 'RESTRICT' as const };

    expect(getUntrackedForeignKeyRelations([], [composite])).toEqual([
      composite,
    ]);
    expect(
      getUntrackedForeignKeyRelations([composite], [actionChanged]),
    ).toEqual([]);
    expect(composite.columns).toEqual(['tenant_id', 'user_id']);
    expect(composite.referencedColumns).toEqual(['tenant_id', 'id']);
  });

  it('uses complete pair signatures for composite reorder and crossing changes', () => {
    const composite = relation({
      name: 'tenant_user_fkey',
      columns: ['tenant_id', 'user_id'],
      referencedColumns: ['tenant_id', 'id'],
    });
    const reorderedPairs = relation({
      name: 'tenant_user_fkey',
      columns: ['user_id', 'tenant_id'],
      referencedColumns: ['id', 'tenant_id'],
    });
    const crossedPairs = relation({
      name: 'tenant_user_fkey',
      columns: ['tenant_id', 'user_id'],
      referencedColumns: ['id', 'tenant_id'],
    });

    expect(
      getUntrackedForeignKeyRelations([composite], [reorderedPairs]),
    ).toEqual([]);
    expect(
      getUntrackedForeignKeyRelations([composite], [crossedPairs]),
    ).toEqual([crossedPairs]);
  });

  it('rejects malformed composites and deduplicates equivalent tracking work', () => {
    const composite = relation({
      name: 'tenant_user_fkey',
      columns: ['tenant_id', 'user_id'],
      referencedColumns: ['tenant_id', 'id'],
      oneToOne: true,
      updateAction: 'SET NULL',
    });
    const duplicate = { ...composite, name: 'duplicate_constraint' };
    const malformed = relation({
      name: 'malformed_fkey',
      columns: ['tenant_id', 'user_id'],
      referencedColumns: ['id'],
    });

    expect(
      getUntrackedForeignKeyRelations([], [composite, duplicate, malformed]),
    ).toEqual([composite]);
    expect(composite.oneToOne).toBe(true);
    expect(composite.updateAction).toBe('SET NULL');
  });
});
