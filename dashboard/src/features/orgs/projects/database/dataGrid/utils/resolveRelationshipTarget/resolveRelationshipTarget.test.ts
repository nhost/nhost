import type {
  ForeignKeyRelation,
  HasuraMetadataTable,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import resolveRelationshipTarget from '@/features/orgs/projects/database/dataGrid/utils/resolveRelationshipTarget/resolveRelationshipTarget';

const childToParentForeignKey: ForeignKeyRelation = {
  name: 'child_parent_fkey',
  columns: ['a', 'b'],
  referencedSchema: 'public',
  referencedTable: 'parent',
  referencedColumns: ['x', 'y'],
  updateAction: 'RESTRICT',
  deleteAction: 'RESTRICT',
};

/** `parent` claims the inverse of a legacy scalar object relationship. */
const inverseMetadataTables: HasuraMetadataTable[] = [
  {
    table: { schema: 'public', name: 'parent' },
    configuration: {},
    array_relationships: [
      {
        name: 'children',
        using: {
          foreign_key_constraint_on: {
            column: 'a',
            table: { schema: 'public', name: 'child' },
          },
        },
      },
    ],
  },
];

describe('resolveRelationshipTarget', () => {
  it('reads the remote table straight off a manual configuration', () => {
    expect(
      resolveRelationshipTarget({
        using: {
          manual_configuration: {
            column_mapping: { a: 'x' },
            remote_table: { schema: 'analytics', name: 'parent' },
          },
        },
      }),
    ).toEqual({ schema: 'analytics', table: 'parent' });
  });

  it('reads the explicitly qualified table of an array relationship', () => {
    expect(
      resolveRelationshipTarget({
        using: {
          foreign_key_constraint_on: {
            columns: ['a', 'b'],
            table: { schema: 'public', name: 'child' },
          },
        },
        selectedSchema: 'public',
        selectedTable: 'parent',
      }),
    ).toEqual({ schema: 'public', table: 'child' });
  });

  it('matches a composite object relationship against the local foreign keys', () => {
    expect(
      resolveRelationshipTarget({
        using: { foreign_key_constraint_on: ['a', 'b'] },
        selectedSchema: 'public',
        selectedTable: 'child',
        foreignKeyRelations: [childToParentForeignKey],
      }),
    ).toEqual({ schema: 'public', table: 'parent' });
  });

  it('falls back to inverse metadata for a legacy scalar relationship with no matching foreign key', () => {
    expect(
      resolveRelationshipTarget({
        using: { foreign_key_constraint_on: 'a' },
        selectedSchema: 'public',
        selectedTable: 'child',
        foreignKeyRelations: [],
        metadataTables: inverseMetadataTables,
      }),
    ).toEqual({ schema: 'public', table: 'parent' });
  });

  it('refuses to guess when two tables claim the same inverse relationship', () => {
    expect(
      resolveRelationshipTarget({
        using: { foreign_key_constraint_on: 'a' },
        selectedSchema: 'public',
        selectedTable: 'child',
        foreignKeyRelations: [],
        metadataTables: [
          ...inverseMetadataTables,
          {
            table: { schema: 'public', name: 'other_parent' },
            configuration: {},
            array_relationships: [
              {
                name: 'children',
                using: {
                  foreign_key_constraint_on: {
                    column: 'a',
                    table: { schema: 'public', name: 'child' },
                  },
                },
              },
            ],
          },
        ],
      }),
    ).toBeUndefined();
  });

  it('returns undefined for an unparseable using payload', () => {
    expect(
      resolveRelationshipTarget({ using: { foreign_key_constraint_on: '' } }),
    ).toBeUndefined();
    expect(resolveRelationshipTarget({ using: undefined })).toBeUndefined();
  });
});
