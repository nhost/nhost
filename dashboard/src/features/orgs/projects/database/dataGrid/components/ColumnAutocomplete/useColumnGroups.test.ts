import type { FetchTableSchemaReturnType } from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery';
import type { FetchMetadataReturnType } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { renderHook } from '@/tests/testUtils';
import useColumnGroups from './useColumnGroups';

const childTableData: FetchTableSchemaReturnType = {
  columns: [
    {
      column_name: 'a',
      table_schema: 'public',
      table_name: 'child',
      udt_name: 'uuid',
    },
    {
      column_name: 'b',
      table_schema: 'public',
      table_name: 'child',
      udt_name: 'uuid',
    },
  ],
  candidateKeys: [],
  uniqueConstraints: [],
  constraintColumnSets: [],
  foreignKeyRelations: [
    {
      name: 'child_a_b_fkey',
      columns: ['a', 'b'],
      referencedSchema: 'public',
      referencedTable: 'parent',
      referencedColumns: ['x', 'y'],
      updateAction: 'RESTRICT',
      deleteAction: 'RESTRICT',
    },
  ],
  error: null,
};

const parentTableData: FetchTableSchemaReturnType = {
  columns: [
    {
      column_name: 'x',
      table_schema: 'public',
      table_name: 'parent',
      udt_name: 'uuid',
    },
    {
      column_name: 'y',
      table_schema: 'public',
      table_name: 'parent',
      udt_name: 'uuid',
    },
  ],
  foreignKeyRelations: [],
  candidateKeys: [],
  uniqueConstraints: [],
  constraintColumnSets: [],
  error: null,
};

const metadata: FetchMetadataReturnType = {
  resourceVersion: 1,
  name: 'default',
  kind: 'postgres',
  tables: [
    {
      table: { name: 'child', schema: 'public' },
      configuration: {},
      object_relationships: [
        { name: 'parent', using: { foreign_key_constraint_on: ['a', 'b'] } },
      ],
    },
    {
      table: { name: 'parent', schema: 'public' },
      configuration: {},
      array_relationships: [
        {
          name: 'children',
          using: {
            foreign_key_constraint_on: {
              columns: ['a', 'b'],
              table: { name: 'child', schema: 'public' },
            },
          },
        },
      ],
    },
  ],
};

describe('useColumnGroups', () => {
  it('includes a composite object relationship (foreign_key_constraint_on: string[]) and resolves its referenced table', () => {
    const { result } = renderHook(() =>
      useColumnGroups({
        selectedSchema: 'public',
        selectedTable: 'child',
        tableData: childTableData,
        metadata,
      }),
    );

    const option = result.current.find(
      ({ group, value }) => group === 'relationships' && value === 'parent',
    );

    expect(option).toBeDefined();
    expect(option?.metadata?.target).toEqual({
      schema: 'public',
      table: 'parent',
      name: 'parent',
    });
  });

  it('includes a composite array relationship ({columns, table} shape) pointing at the child table', () => {
    const { result } = renderHook(() =>
      useColumnGroups({
        selectedSchema: 'public',
        selectedTable: 'parent',
        tableData: parentTableData,
        metadata,
      }),
    );

    const option = result.current.find(
      ({ group, value }) => group === 'relationships' && value === 'children',
    );

    expect(option).toBeDefined();
    expect(option?.metadata?.target).toEqual({
      schema: 'public',
      table: 'child',
      name: 'children',
    });
  });

  it('falls back to a unique inverse metadata relationship for a legacy scalar object relationship', () => {
    const { result } = renderHook(() =>
      useColumnGroups({
        selectedSchema: 'public',
        selectedTable: 'child',
        tableData: { ...childTableData, foreignKeyRelations: [] },
        metadata: {
          ...metadata,
          tables: [
            {
              table: { name: 'child', schema: 'public' },
              configuration: {},
              object_relationships: [
                {
                  name: 'parent',
                  using: { foreign_key_constraint_on: 'a' },
                },
              ],
            },
            {
              table: { name: 'parent', schema: 'public' },
              configuration: {},
              array_relationships: [
                {
                  name: 'children',
                  using: {
                    foreign_key_constraint_on: {
                      column: 'a',
                      table: { name: 'child', schema: 'public' },
                    },
                  },
                },
              ],
            },
          ],
        },
      }),
    );

    const option = result.current.find(({ value }) => value === 'parent');
    expect(option?.metadata?.target).toEqual({
      schema: 'public',
      table: 'parent',
      name: 'parent',
    });
  });

  it('preserves a complete manual mapping without table schema foreign keys', () => {
    const { result } = renderHook(() =>
      useColumnGroups({
        selectedSchema: 'public',
        selectedTable: 'child',
        tableData: { ...childTableData, foreignKeyRelations: [] },
        metadata: {
          ...metadata,
          tables: [
            {
              table: { name: 'child', schema: 'public' },
              configuration: {},
              object_relationships: [
                {
                  name: 'parent',
                  using: {
                    manual_configuration: {
                      remote_table: { name: 'parent', schema: 'public' },
                      column_mapping: { a: 'x' },
                    },
                  },
                },
              ],
            },
          ],
        },
      }),
    );

    const option = result.current.find(({ value }) => value === 'parent');
    expect(option?.metadata?.target).toEqual({
      schema: 'public',
      table: 'parent',
      name: 'parent',
    });
  });

  it('rejects malformed and ambiguous inverse metadata fallbacks', () => {
    const { result } = renderHook(() =>
      useColumnGroups({
        selectedSchema: 'public',
        selectedTable: 'child',
        tableData: { ...childTableData, foreignKeyRelations: [] },
        metadata: {
          ...metadata,
          tables: [
            {
              table: { name: 'child', schema: 'public' },
              configuration: {},
              object_relationships: [
                {
                  name: 'ambiguous_parent',
                  using: { foreign_key_constraint_on: 'a' },
                },
                {
                  name: 'malformed_parent',
                  using: { foreign_key_constraint_on: ['a', 'a'] },
                },
              ],
            },
            ...['parent', 'alternate_parent'].map((name) => ({
              table: { name, schema: 'public' },
              configuration: {},
              array_relationships: [
                {
                  name: 'children',
                  using: {
                    foreign_key_constraint_on: {
                      column: 'a',
                      table: { name: 'child', schema: 'public' },
                    },
                  },
                },
              ],
            })),
          ],
        },
      }),
    );

    expect(
      result.current.filter(({ group }) => group === 'relationships'),
    ).toEqual([]);
  });

  it('omits malformed and ambiguous relationship metadata', () => {
    const { result } = renderHook(() =>
      useColumnGroups({
        selectedSchema: 'public',
        selectedTable: 'child',
        tableData: {
          ...childTableData,
          foreignKeyRelations: [
            ...childTableData.foreignKeyRelations,
            {
              ...childTableData.foreignKeyRelations[0],
              name: 'duplicate_child_a_b_fkey',
            },
          ],
        },
        metadata: {
          ...metadata,
          tables: [
            {
              table: { name: 'child', schema: 'public' },
              configuration: {},
              object_relationships: [
                {
                  name: 'ambiguous_parent',
                  using: { foreign_key_constraint_on: ['a', 'b'] },
                },
                {
                  name: 'malformed_parent',
                  using: { foreign_key_constraint_on: ['a', 'a'] },
                },
              ],
            },
          ],
        },
      }),
    );

    expect(
      result.current.filter(({ group }) => group === 'relationships'),
    ).toEqual([]);
  });
});
