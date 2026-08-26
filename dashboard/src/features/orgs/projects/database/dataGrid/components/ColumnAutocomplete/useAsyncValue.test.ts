import type { FetchTableSchemaReturnType } from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery';
import type { FetchMetadataReturnType } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { renderHook, waitFor } from '@/tests/testUtils';
import useAsyncValue from './useAsyncValue';

const makeTableData = (
  columnNames: string[],
): Partial<FetchTableSchemaReturnType> => ({
  columns: columnNames.map((name) => ({
    column_name: name,
    table_schema: 'public',
    table_name: 'users',
    udt_name: 'text',
  })),
  constraintColumnSets: [],
});

describe('useAsyncValue', () => {
  it('initializes immediately when initialValue is empty string', async () => {
    const { result } = renderHook(() =>
      useAsyncValue({
        selectedSchema: 'public',
        selectedTable: 'users',
        initialValue: '',
        isTableLoading: false,
        isMetadataLoading: false,
        tableData: makeTableData(['id', 'name']) as FetchTableSchemaReturnType,
        metadata: undefined,
      }),
    );

    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });
    expect(result.current.selectedColumn).toBeNull();
  });

  it('initializes immediately when initialValue is undefined', async () => {
    const { result } = renderHook(() =>
      useAsyncValue({
        selectedSchema: 'public',
        selectedTable: 'users',
        initialValue: undefined,
        isTableLoading: false,
        isMetadataLoading: false,
        tableData: makeTableData(['id', 'name']) as FetchTableSchemaReturnType,
        metadata: undefined,
      }),
    );

    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });
    expect(result.current.selectedColumn).toBeNull();
  });

  it('resolves a simple column from initialValue', async () => {
    const { result } = renderHook(() =>
      useAsyncValue({
        selectedSchema: 'public',
        selectedTable: 'users',
        initialValue: 'name',
        isTableLoading: false,
        isMetadataLoading: false,
        tableData: makeTableData(['id', 'name']) as FetchTableSchemaReturnType,
        metadata: undefined,
      }),
    );

    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });
    expect(result.current.selectedColumn).toMatchObject({
      value: 'name',
      label: 'name',
      group: 'columns',
    });
  });

  it('clears selection when initialValue column is not found in table', async () => {
    const { result } = renderHook(() =>
      useAsyncValue({
        selectedSchema: 'public',
        selectedTable: 'users',
        initialValue: 'nonexistent',
        isTableLoading: false,
        isMetadataLoading: false,
        tableData: makeTableData(['id', 'name']) as FetchTableSchemaReturnType,
        metadata: undefined,
      }),
    );

    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });
    expect(result.current.selectedColumn).toBeNull();
  });

  it('waits for table data before initializing', async () => {
    const { result, rerender } = renderHook((props) => useAsyncValue(props), {
      initialProps: {
        selectedSchema: 'public',
        selectedTable: 'users',
        initialValue: 'name',
        isTableLoading: true,
        isMetadataLoading: false,
        tableData: undefined as FetchTableSchemaReturnType | undefined,
        metadata: undefined,
      },
    });

    expect(result.current.initialized).toBe(false);
    expect(result.current.selectedColumn).toBeNull();

    rerender({
      selectedSchema: 'public',
      selectedTable: 'users',
      initialValue: 'name',
      isTableLoading: false,
      isMetadataLoading: false,
      tableData: makeTableData(['id', 'name']) as FetchTableSchemaReturnType,
      metadata: undefined,
    });

    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });
    expect(result.current.selectedColumn).toMatchObject({
      value: 'name',
      label: 'name',
    });
  });

  it('calls onInitialized with resolved column', async () => {
    const onInitialized = vi.fn();

    renderHook(() =>
      useAsyncValue({
        selectedSchema: 'public',
        selectedTable: 'users',
        initialValue: 'name',
        isTableLoading: false,
        isMetadataLoading: false,
        tableData: makeTableData(['id', 'name']) as FetchTableSchemaReturnType,
        metadata: undefined,
        onInitialized,
      }),
    );

    await waitFor(() => {
      expect(onInitialized).toHaveBeenCalledWith(
        expect.objectContaining({ value: 'name' }),
      );
    });
  });

  it('traverses a composite relationship only after resolving its complete mapping', async () => {
    const metadata: FetchMetadataReturnType = {
      resourceVersion: 1,
      name: 'default',
      kind: 'postgres',
      tables: [
        {
          table: { schema: 'public', name: 'child' },
          configuration: {},
          object_relationships: [
            {
              name: 'parent',
              using: { foreign_key_constraint_on: ['a', 'b'] },
            },
          ],
        },
      ],
    };
    const childTableData = {
      ...makeTableData(['a', 'b']),
      foreignKeyRelations: [
        {
          name: 'child_parent_fkey',
          columns: ['a', 'b'],
          referencedSchema: 'public',
          referencedTable: 'parent',
          referencedColumns: ['x', 'y'],
          updateAction: 'RESTRICT' as const,
          deleteAction: 'RESTRICT' as const,
        },
      ],
      candidateKeys: [],
      uniqueConstraints: [],
      error: null,
    } as FetchTableSchemaReturnType;
    const parentTableData = {
      ...makeTableData(['x', 'y']),
      foreignKeyRelations: [],
      candidateKeys: [],
      uniqueConstraints: [],
      error: null,
    } as FetchTableSchemaReturnType;
    const { result, rerender } = renderHook((props) => useAsyncValue(props), {
      initialProps: {
        selectedSchema: 'public',
        selectedTable: 'child',
        initialValue: 'parent.x',
        isTableLoading: false,
        isMetadataLoading: false,
        tableData: childTableData,
        metadata,
      },
    });

    await waitFor(() => {
      expect(result.current.activeRelationship).toEqual({
        schema: 'public',
        table: 'parent',
        name: 'parent',
      });
    });

    rerender({
      selectedSchema: 'public',
      selectedTable: 'parent',
      initialValue: 'parent.x',
      isTableLoading: false,
      isMetadataLoading: false,
      tableData: parentTableData,
      metadata,
    });

    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });
    expect(result.current.relationshipDotNotation).toBe('parent');
    expect(result.current.selectedColumn?.value).toBe('x');
  });

  it('rehydrates a legacy scalar relationship through inverse metadata', async () => {
    const metadata: FetchMetadataReturnType = {
      resourceVersion: 1,
      name: 'default',
      kind: 'postgres',
      tables: [
        {
          table: { schema: 'public', name: 'child' },
          configuration: {},
          object_relationships: [
            {
              name: 'parent',
              using: { foreign_key_constraint_on: 'a' },
            },
          ],
        },
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
      ],
    };
    const childTableData = {
      ...makeTableData(['a']),
      foreignKeyRelations: [],
      candidateKeys: [],
      uniqueConstraints: [],
      error: null,
    } as FetchTableSchemaReturnType;
    const parentTableData = {
      ...makeTableData(['x']),
      foreignKeyRelations: [],
      candidateKeys: [],
      uniqueConstraints: [],
      error: null,
    } as FetchTableSchemaReturnType;
    const { result, rerender } = renderHook((props) => useAsyncValue(props), {
      initialProps: {
        selectedSchema: 'public',
        selectedTable: 'child',
        initialValue: 'parent.x',
        isTableLoading: false,
        isMetadataLoading: false,
        tableData: childTableData,
        metadata,
      },
    });

    await waitFor(() => {
      expect(result.current.activeRelationship).toEqual({
        schema: 'public',
        table: 'parent',
        name: 'parent',
      });
    });

    rerender({
      selectedSchema: 'public',
      selectedTable: 'parent',
      initialValue: 'parent.x',
      isTableLoading: false,
      isMetadataLoading: false,
      tableData: parentTableData,
      metadata,
    });

    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });
    expect(result.current.relationshipDotNotation).toBe('parent');
    expect(result.current.selectedColumn?.value).toBe('x');
  });

  it('does not call onInitialized when initialValue is empty', async () => {
    const onInitialized = vi.fn();

    const { result } = renderHook(() =>
      useAsyncValue({
        selectedSchema: 'public',
        selectedTable: 'users',
        initialValue: '',
        isTableLoading: false,
        isMetadataLoading: false,
        tableData: makeTableData(['id', 'name']) as FetchTableSchemaReturnType,
        metadata: undefined,
        onInitialized,
      }),
    );

    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });
    expect(onInitialized).not.toHaveBeenCalled();
  });
});
