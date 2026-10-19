import type { FetchTableSchemaReturnType } from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery';
import type {
  FetchMetadataReturnType,
  HasuraMetadataRelationship,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { renderHook } from '@/tests/testUtils';
import useColumnGroups from './useColumnGroups';

const tableData = {
  columns: [
    { column_name: 'tenant_id' },
    { column_name: 'order_id' },
  ] as FetchTableSchemaReturnType['columns'],
  foreignKeyRelations: [
    {
      columnName: 'tenant_id',
      referencedSchema: 'public',
      referencedTable: 'orders',
      referencedColumn: 'tenant_id',
    },
  ],
} as FetchTableSchemaReturnType;

function makeMetadata(
  relationshipType: 'object_relationships' | 'array_relationships',
  relationship: HasuraMetadataRelationship,
): FetchMetadataReturnType {
  return {
    resourceVersion: 1,
    tables: [
      {
        table: { name: 'order_items', schema: 'public' },
        configuration: {},
        ...(relationshipType === 'object_relationships'
          ? { object_relationships: [relationship] }
          : { array_relationships: [relationship] }),
      },
    ],
  };
}

function getRelationships(metadata: FetchMetadataReturnType) {
  const { result } = renderHook(() =>
    useColumnGroups({
      selectedSchema: 'public',
      selectedTable: 'order_items',
      tableData,
      metadata,
    }),
  );

  return result.current.filter(({ group }) => group === 'relationships');
}

describe('useColumnGroups', () => {
  it('keeps single-column object relationship resolution unchanged', () => {
    const relationships = getRelationships(
      makeMetadata('object_relationships', {
        name: 'order',
        using: { foreign_key_constraint_on: 'tenant_id' },
      }),
    );

    expect(relationships).toHaveLength(1);
    expect(relationships[0]).toMatchObject({
      value: 'order',
      metadata: {
        target: {
          schema: 'public',
          table: 'orders',
          column: 'tenant_id',
        },
      },
    });
  });

  it('does not resolve a composite object constraint against a singular foreign key relation', () => {
    const relationships = getRelationships(
      makeMetadata('object_relationships', {
        name: 'order',
        using: {
          foreign_key_constraint_on: ['tenant_id', 'order_id'],
        },
      }),
    );

    expect(relationships).toHaveLength(1);
    expect(relationships[0]).toMatchObject({
      value: 'order',
      metadata: {
        target: {
          schema: 'public',
          table: 'order_items',
          column: 'tenant_id',
        },
      },
    });
  });

  it('keeps single-column array relationship resolution unchanged', () => {
    const relationships = getRelationships(
      makeMetadata('array_relationships', {
        name: 'shipments',
        using: {
          foreign_key_constraint_on: {
            column: 'sku',
            table: { name: 'shipments', schema: 'logistics' },
          },
        },
      }),
    );

    expect(relationships).toHaveLength(1);
    expect(relationships[0]).toMatchObject({
      value: 'shipments',
      metadata: {
        target: {
          schema: 'logistics',
          table: 'shipments',
          column: 'sku',
        },
      },
    });
  });

  it('does not resolve an array relationship against a same-named local foreign key column', () => {
    const relationships = getRelationships(
      makeMetadata('array_relationships', {
        name: 'shipments',
        using: {
          foreign_key_constraint_on: {
            column: 'tenant_id',
            table: { name: 'shipments', schema: 'logistics' },
          },
        },
      }),
    );

    expect(relationships).toHaveLength(1);
    expect(relationships[0]).toMatchObject({
      value: 'shipments',
      metadata: {
        target: {
          schema: 'logistics',
          table: 'shipments',
          column: 'tenant_id',
        },
      },
    });
  });

  it('resolves a composite array relationship to its metadata table', () => {
    const relationships = getRelationships(
      makeMetadata('array_relationships', {
        name: 'shipments',
        using: {
          foreign_key_constraint_on: {
            columns: ['tenant_id', 'order_id'],
            table: { name: 'shipments', schema: 'logistics' },
          },
        },
      }),
    );

    expect(relationships).toHaveLength(1);
    expect(relationships[0]).toMatchObject({
      value: 'shipments',
      metadata: {
        target: {
          schema: 'logistics',
          table: 'shipments',
          column: 'tenant_id',
        },
      },
    });
  });
});
