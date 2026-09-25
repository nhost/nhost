import { vi } from 'vitest';
import type { FetchTableReturnType } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
import type {
  FetchMetadataReturnType,
  HasuraMetadataRelationship,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { renderHook, waitFor } from '@/tests/testUtils';
import useAsyncValue from './useAsyncValue';

const makeTableData = (
  columnNames: string[],
): Partial<FetchTableReturnType> => ({
  columns: columnNames.map((name) => ({
    column_name: name,
    table_schema: 'public',
    table_name: 'users',
    udt_name: 'text',
  })),
});

const orderItemsTableData = {
  ...makeTableData(['tenant_id', 'order_id']),
  foreignKeyRelations: [
    {
      columns: ['order_id'],
      referencedSchema: 'public',
      referencedTable: 'orders',
      referencedColumns: ['id'],
    },
  ],
} as FetchTableReturnType;

const compositeOrderItemsTableData = {
  ...makeTableData(['tenant_id', 'order_id']),
  foreignKeyRelations: [
    {
      columns: ['tenant_id', 'order_id'],
      referencedSchema: 'public',
      referencedTable: 'orders',
      referencedColumns: ['tenant_id', 'id'],
    },
  ],
} as FetchTableReturnType;

function makeMetadata(
  relationshipType: 'object_relationships' | 'array_relationships',
  relationship: HasuraMetadataRelationship,
  table = { schema: 'public', name: 'order_items' },
): FetchMetadataReturnType {
  return {
    resourceVersion: 1,
    tables: [
      {
        table,
        configuration: {},
        ...(relationshipType === 'object_relationships'
          ? { object_relationships: [relationship] }
          : { array_relationships: [relationship] }),
      },
    ],
  };
}

describe('useAsyncValue', () => {
  it('initializes immediately when initialValue is empty string', async () => {
    const { result } = renderHook(() =>
      useAsyncValue({
        selectedSchema: 'public',
        selectedTable: 'users',
        initialValue: '',
        isTableLoading: false,
        isMetadataLoading: false,
        tableData: makeTableData(['id', 'name']) as FetchTableReturnType,
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
        tableData: makeTableData(['id', 'name']) as FetchTableReturnType,
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
        tableData: makeTableData(['id', 'name']) as FetchTableReturnType,
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
        tableData: makeTableData(['id', 'name']) as FetchTableReturnType,
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
        tableData: undefined as FetchTableReturnType | undefined,
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
      tableData: makeTableData(['id', 'name']) as FetchTableReturnType,
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
        tableData: makeTableData(['id', 'name']) as FetchTableReturnType,
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

  it('resolves a single-column object relationship through its foreign key relation', async () => {
    const metadata = makeMetadata('object_relationships', {
      name: 'order',
      using: { foreign_key_constraint_on: 'order_id' },
    });
    const { result, rerender } = renderHook((props) => useAsyncValue(props), {
      initialProps: {
        selectedSchema: 'public',
        selectedTable: 'order_items',
        initialValue: 'order.total',
        isTableLoading: false,
        isMetadataLoading: false,
        tableData: orderItemsTableData,
        metadata,
      },
    });

    rerender({
      selectedSchema: 'public',
      selectedTable: 'orders',
      initialValue: 'order.total',
      isTableLoading: false,
      isMetadataLoading: false,
      tableData: makeTableData(['total']) as FetchTableReturnType,
      metadata,
    });

    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });
    expect(result.current.selectedColumn).toMatchObject({ value: 'total' });
    expect(result.current.selectedRelationships).toEqual([
      { schema: 'public', table: 'orders', name: 'order' },
    ]);
  });

  it('resolves a composite object relationship through its foreign key relation', async () => {
    const metadata = makeMetadata('object_relationships', {
      name: 'order',
      using: {
        foreign_key_constraint_on: ['tenant_id', 'order_id'],
      },
    });
    const { result, rerender } = renderHook((props) => useAsyncValue(props), {
      initialProps: {
        selectedSchema: 'public',
        selectedTable: 'order_items',
        initialValue: 'order.total',
        isTableLoading: false,
        isMetadataLoading: false,
        tableData: compositeOrderItemsTableData,
        metadata,
      },
    });

    rerender({
      selectedSchema: 'public',
      selectedTable: 'orders',
      initialValue: 'order.total',
      isTableLoading: false,
      isMetadataLoading: false,
      tableData: makeTableData(['total']) as FetchTableReturnType,
      metadata,
    });

    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });
    expect(result.current.selectedColumn).toMatchObject({ value: 'total' });
    expect(result.current.selectedRelationships).toEqual([
      { schema: 'public', table: 'orders', name: 'order' },
    ]);
  });

  it('does not match a single column relationship against a composite foreign key', async () => {
    const { result } = renderHook(() =>
      useAsyncValue({
        selectedSchema: 'public',
        selectedTable: 'order_items',
        initialValue: 'order.total',
        isTableLoading: false,
        isMetadataLoading: false,
        tableData: compositeOrderItemsTableData,
        metadata: makeMetadata('object_relationships', {
          name: 'order',
          using: { foreign_key_constraint_on: 'order_id' },
        }),
      }),
    );

    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });
    expect(result.current.selectedColumn).toBeNull();
    expect(result.current.selectedRelationships).toEqual([]);
  });

  it.each([
    [
      'single-column',
      {
        column: 'order_id',
        table: { schema: 'logistics', name: 'shipments' },
      },
    ],
    [
      'composite',
      {
        columns: ['tenant_id', 'order_id'],
        table: { schema: 'logistics', name: 'shipments' },
      },
    ],
  ] satisfies [
    string,
    NonNullable<
      HasuraMetadataRelationship['using']['foreign_key_constraint_on']
    >,
  ][])(
    'resolves a %s array relationship through its metadata table',
    async (_name, foreignKeyConstraintOn) => {
      const metadata = makeMetadata(
        'array_relationships',
        {
          name: 'shipments',
          using: { foreign_key_constraint_on: foreignKeyConstraintOn },
        },
        { schema: 'public', name: 'orders' },
      );
      const { result, rerender } = renderHook((props) => useAsyncValue(props), {
        initialProps: {
          selectedSchema: 'public',
          selectedTable: 'orders',
          initialValue: 'shipments.tracking_number',
          isTableLoading: false,
          isMetadataLoading: false,
          tableData: makeTableData(['id']) as FetchTableReturnType,
          metadata,
        },
      });

      rerender({
        selectedSchema: 'logistics',
        selectedTable: 'shipments',
        initialValue: 'shipments.tracking_number',
        isTableLoading: false,
        isMetadataLoading: false,
        tableData: makeTableData(['tracking_number']) as FetchTableReturnType,
        metadata,
      });

      await waitFor(() => {
        expect(result.current.initialized).toBe(true);
      });
      expect(result.current.selectedColumn).toMatchObject({
        value: 'tracking_number',
      });
      expect(result.current.selectedRelationships).toEqual([
        { schema: 'logistics', table: 'shipments', name: 'shipments' },
      ]);
    },
  );

  it('does not call onInitialized when initialValue is empty', async () => {
    const onInitialized = vi.fn();

    const { result } = renderHook(() =>
      useAsyncValue({
        selectedSchema: 'public',
        selectedTable: 'users',
        initialValue: '',
        isTableLoading: false,
        isMetadataLoading: false,
        tableData: makeTableData(['id', 'name']) as FetchTableReturnType,
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
