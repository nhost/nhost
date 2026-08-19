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
  it('rejects a duplicate scalar create when neither relation has an id', () => {
    const existing = relation();

    expect(() =>
      validateForeignKeyRelationCollision(relation(), [existing]),
    ).toThrow('This foreign key relation already exists');
  });

  it('excludes only the edited scalar row by index when ids are absent', () => {
    const first = relation();
    const second = relation({
      columns: ['editor_id'],
      referencedTable: 'editors',
    });

    expect(() =>
      validateForeignKeyRelationCollision({ ...second }, [first, second], 1),
    ).not.toThrow();
    expect(() =>
      validateForeignKeyRelationCollision({ ...first }, [first, second], 1),
    ).toThrow('This foreign key relation already exists');
  });

  it('rejects a duplicate composite create after whole-pair reordering', () => {
    const existing = relation({
      columns: ['tenant_id', 'author_id'],
      referencedColumns: ['tenant_id', 'id'],
    });
    const reordered = relation({
      columns: ['author_id', 'tenant_id'],
      referencedColumns: ['id', 'tenant_id'],
    });

    expect(() =>
      validateForeignKeyRelationCollision(reordered, [existing]),
    ).toThrow('This foreign key relation already exists');
  });

  it('preserves composite edit exclusion while distinguishing crossed pairs', () => {
    const first = relation({
      columns: ['tenant_id', 'author_id'],
      referencedColumns: ['tenant_id', 'id'],
    });
    const second = relation({
      columns: ['workspace_id', 'editor_id'],
      referencedColumns: ['workspace_id', 'id'],
      referencedTable: 'editors',
    });
    const reorderedFirst = relation({
      columns: ['author_id', 'tenant_id'],
      referencedColumns: ['id', 'tenant_id'],
    });
    const crossedFirst = relation({
      columns: ['tenant_id', 'author_id'],
      referencedColumns: ['id', 'tenant_id'],
    });

    expect(() =>
      validateForeignKeyRelationCollision(first, [first, second], 0),
    ).not.toThrow();
    expect(() =>
      validateForeignKeyRelationCollision(reorderedFirst, [first, second], 1),
    ).toThrow('This foreign key relation already exists');
    expect(() =>
      validateForeignKeyRelationCollision(crossedFirst, [first, second], 1),
    ).not.toThrow();
  });
});
