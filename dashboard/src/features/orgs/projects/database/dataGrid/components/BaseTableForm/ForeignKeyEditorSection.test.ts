import { validateForeignKeyRelationCollision } from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm/ForeignKeyEditorSection';
import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

function relation(
  overrides: Partial<ForeignKeyRelation> = {},
): ForeignKeyRelation {
  return {
    columns: ['author_id'],
    referencedSchema: 'public',
    referencedTable: 'authors',
    referencedColumns: ['id'],
    updateAction: 'RESTRICT',
    deleteAction: 'RESTRICT',
    ...overrides,
  };
}

describe('validateForeignKeyRelationCollision', () => {
  it('rejects duplicate composite relations while excluding only the edited row by index', () => {
    const first = relation({
      columns: ['tenant_id', 'author_id'],
      referencedColumns: ['tenant_id', 'id'],
    });
    const second = relation({
      columns: ['workspace_id', 'editor_id'],
      referencedColumns: ['workspace_id', 'id'],
      referencedTable: 'editors',
    });

    expect(() =>
      validateForeignKeyRelationCollision({ ...first }, [first, second]),
    ).toThrow('This foreign key relation already exists');
    expect(() =>
      validateForeignKeyRelationCollision(first, [first, second], 0),
    ).not.toThrow();
    expect(() =>
      validateForeignKeyRelationCollision({ ...first }, [first, second], 1),
    ).toThrow('This foreign key relation already exists');
  });
});
