import type { HasuraMetadataTable } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { renderHook } from '@/tests/testUtils';
import type {
  SchemaDiagramColumn,
  SchemaDiagramForeignKey,
} from './useAllTableColumns';
import useSchemaGraph, {
  columnHandleId,
  EDGE_MARKER_IDS,
  type FkEdgeData,
  nodeIdFor,
  type TableNode,
  type TableNodeData,
} from './useSchemaGraph';

function buildColumn(
  overrides: Partial<SchemaDiagramColumn> = {},
): SchemaDiagramColumn {
  return {
    schema: 'public',
    table: 'users',
    columnName: 'id',
    dataType: 'uuid',
    udtName: 'uuid',
    isNullable: false,
    ordinalPosition: 1,
    isPrimary: true,
    ...overrides,
  };
}

function buildForeignKey(
  overrides: Partial<SchemaDiagramForeignKey> = {},
): SchemaDiagramForeignKey {
  return {
    fromSchema: 'public',
    fromTable: 'posts',
    fromColumn: 'author_id',
    toSchema: 'public',
    toTable: 'users',
    toColumn: 'id',
    constraintName: 'posts_author_id_fkey',
    ...overrides,
  };
}

function buildMetadataTable(
  schema: string,
  name: string,
  overrides: Partial<HasuraMetadataTable> = {},
): HasuraMetadataTable {
  return {
    table: { name, schema },
    configuration: {},
    ...overrides,
  };
}

function dataOf(node: TableNode): TableNodeData {
  return node.data;
}

describe('useSchemaGraph', () => {
  it('builds one node per table from the union of columns and metadataTables', () => {
    const columns: SchemaDiagramColumn[] = [
      buildColumn({ schema: 'public', table: 'users', columnName: 'id' }),
      buildColumn({
        schema: 'public',
        table: 'posts',
        columnName: 'id',
        ordinalPosition: 1,
      }),
    ];
    const metadataTables: HasuraMetadataTable[] = [
      buildMetadataTable('public', 'users'),
      buildMetadataTable('public', 'comments'),
    ];

    const { result } = renderHook(() =>
      useSchemaGraph({
        metadataTables,
        columns,
        foreignKeys: [],
        role: 'admin',
        visibleSchemas: new Set(['public']),
        hideTablesWithoutPermissions: false,
      }),
    );

    const ids = result.current.nodes.map((n) => n.id).sort();
    expect(ids).toEqual(
      ['public.users', 'public.posts', 'public.comments'].sort(),
    );
    expect(result.current.totalTableCount).toBe(3);
  });

  it('returns metadataTable: undefined for tables that have no Hasura metadata', () => {
    const columns = [
      buildColumn({ schema: 'public', table: 'untracked', columnName: 'id' }),
    ];

    const { result } = renderHook(() =>
      useSchemaGraph({
        metadataTables: [],
        columns,
        foreignKeys: [],
        role: 'admin',
        visibleSchemas: new Set(['public']),
        hideTablesWithoutPermissions: false,
      }),
    );

    const node = result.current.nodes.find((n) => n.id === 'public.untracked')!;
    expect(dataOf(node).metadataTable).toBeUndefined();
  });

  it('returns no nodes when visibleSchemas is empty', () => {
    const columns = [buildColumn({ schema: 'public', table: 'users' })];

    const { result } = renderHook(() =>
      useSchemaGraph({
        metadataTables: [buildMetadataTable('public', 'users')],
        columns,
        foreignKeys: [],
        role: 'admin',
        visibleSchemas: new Set(),
        hideTablesWithoutPermissions: false,
      }),
    );

    expect(result.current.nodes).toEqual([]);
    expect(result.current.edges).toEqual([]);
    expect(result.current.totalTableCount).toBe(1);
  });

  it('filters nodes by visibleSchemas while keeping totalTableCount accurate', () => {
    const columns = [
      buildColumn({ schema: 'public', table: 'users' }),
      buildColumn({ schema: 'auth', table: 'users' }),
    ];

    const { result } = renderHook(() =>
      useSchemaGraph({
        metadataTables: [],
        columns,
        foreignKeys: [],
        role: 'admin',
        visibleSchemas: new Set(['public']),
        hideTablesWithoutPermissions: false,
      }),
    );

    const ids = result.current.nodes.map((n) => n.id);
    expect(ids).toEqual(['public.users']);
    expect(result.current.totalTableCount).toBe(2);
  });

  it('hides tables without permissions for a non-admin role when hideTablesWithoutPermissions is true', () => {
    const columns = [
      buildColumn({ schema: 'public', table: 'users' }),
      buildColumn({ schema: 'public', table: 'posts' }),
    ];
    const metadataTables: HasuraMetadataTable[] = [
      buildMetadataTable('public', 'users', {
        select_permissions: [
          { role: 'user', permission: { columns: ['id'], filter: {} } },
        ],
      }),
      buildMetadataTable('public', 'posts'),
    ];

    const { result } = renderHook(() =>
      useSchemaGraph({
        metadataTables,
        columns,
        foreignKeys: [],
        role: 'user',
        visibleSchemas: new Set(['public']),
        hideTablesWithoutPermissions: true,
      }),
    );

    const ids = result.current.nodes.map((n) => n.id);
    expect(ids).toEqual(['public.users']);
    expect(result.current.totalTableCount).toBe(2);
  });

  it('keeps tables with no permissions when hideTablesWithoutPermissions is false', () => {
    const columns = [buildColumn({ schema: 'public', table: 'posts' })];

    const { result } = renderHook(() =>
      useSchemaGraph({
        metadataTables: [buildMetadataTable('public', 'posts')],
        columns,
        foreignKeys: [],
        role: 'user',
        visibleSchemas: new Set(['public']),
        hideTablesWithoutPermissions: false,
      }),
    );

    expect(result.current.nodes.map((n) => n.id)).toEqual(['public.posts']);
  });

  it('drops FK edges whose source or target node is filtered out', () => {
    const columns = [
      buildColumn({
        schema: 'public',
        table: 'posts',
        columnName: 'author_id',
        isPrimary: false,
      }),
      buildColumn({ schema: 'auth', table: 'users', columnName: 'id' }),
    ];
    const foreignKeys = [
      buildForeignKey({
        fromSchema: 'public',
        fromTable: 'posts',
        fromColumn: 'author_id',
        toSchema: 'auth',
        toTable: 'users',
        toColumn: 'id',
      }),
    ];

    const { result } = renderHook(() =>
      useSchemaGraph({
        metadataTables: [],
        columns,
        foreignKeys,
        role: 'admin',
        visibleSchemas: new Set(['public']),
        hideTablesWithoutPermissions: false,
      }),
    );

    expect(result.current.nodes.map((n) => n.id)).toEqual(['public.posts']);
    expect(result.current.edges).toEqual([]);
  });

  it('emits FK edges with the expected handles and ids when both endpoints are visible', () => {
    const columns = [
      buildColumn({
        schema: 'public',
        table: 'posts',
        columnName: 'author_id',
        isPrimary: false,
      }),
      buildColumn({ schema: 'public', table: 'users', columnName: 'id' }),
    ];
    const fk = buildForeignKey();

    const { result } = renderHook(() =>
      useSchemaGraph({
        metadataTables: [],
        columns,
        foreignKeys: [fk],
        role: 'admin',
        visibleSchemas: new Set(['public']),
        hideTablesWithoutPermissions: false,
      }),
    );

    expect(result.current.edges).toHaveLength(1);
    const edge = result.current.edges[0];
    expect(edge.source).toBe(nodeIdFor('public', 'posts'));
    expect(edge.target).toBe(nodeIdFor('public', 'users'));
    expect(edge.sourceHandle).toBe(columnHandleId('source', 'author_id'));
    expect(edge.targetHandle).toBe(columnHandleId('target', 'id'));
    expect(edge.id).toBe(`${fk.constraintName}-public.posts.author_id`);
  });

  it('emits one edge per column pair for composite foreign keys', () => {
    const columns = [
      buildColumn({
        schema: 'public',
        table: 'order_items',
        columnName: 'order_id',
        ordinalPosition: 1,
        isPrimary: false,
      }),
      buildColumn({
        schema: 'public',
        table: 'order_items',
        columnName: 'tenant_id',
        ordinalPosition: 2,
        isPrimary: false,
      }),
      buildColumn({
        schema: 'public',
        table: 'orders',
        columnName: 'id',
        ordinalPosition: 1,
        isPrimary: true,
      }),
      buildColumn({
        schema: 'public',
        table: 'orders',
        columnName: 'tenant_id',
        ordinalPosition: 2,
        isPrimary: true,
      }),
    ];
    const foreignKeys = [
      buildForeignKey({
        fromTable: 'order_items',
        fromColumn: 'order_id',
        toTable: 'orders',
        toColumn: 'id',
        constraintName: 'order_items_order_fkey',
      }),
      buildForeignKey({
        fromTable: 'order_items',
        fromColumn: 'tenant_id',
        toTable: 'orders',
        toColumn: 'tenant_id',
        constraintName: 'order_items_order_fkey',
      }),
    ];

    const { result } = renderHook(() =>
      useSchemaGraph({
        metadataTables: [],
        columns,
        foreignKeys,
        role: 'admin',
        visibleSchemas: new Set(['public']),
        hideTablesWithoutPermissions: false,
      }),
    );

    expect(result.current.edges).toHaveLength(2);
    const edgeIds = result.current.edges.map((e) => e.id).sort();
    expect(edgeIds).toEqual(
      [
        'order_items_order_fkey-public.order_items.order_id',
        'order_items_order_fkey-public.order_items.tenant_id',
      ].sort(),
    );

    const orderItems = result.current.nodes.find(
      (n) => n.id === 'public.order_items',
    )!;
    const byName = Object.fromEntries(
      dataOf(orderItems).columns.map((c) => [c.name, c]),
    );
    expect(byName.order_id.isForeignKey).toBe(true);
    expect(byName.tenant_id.isForeignKey).toBe(true);
  });

  it('marks columns as isForeignKey when they appear in foreignKeys', () => {
    const columns = [
      buildColumn({
        schema: 'public',
        table: 'posts',
        columnName: 'id',
        ordinalPosition: 1,
        isPrimary: true,
      }),
      buildColumn({
        schema: 'public',
        table: 'posts',
        columnName: 'author_id',
        ordinalPosition: 2,
        isPrimary: false,
      }),
      buildColumn({
        schema: 'public',
        table: 'users',
        columnName: 'id',
      }),
    ];

    const { result } = renderHook(() =>
      useSchemaGraph({
        metadataTables: [],
        columns,
        foreignKeys: [buildForeignKey()],
        role: 'admin',
        visibleSchemas: new Set(['public']),
        hideTablesWithoutPermissions: false,
      }),
    );

    const posts = result.current.nodes.find((n) => n.id === 'public.posts')!;
    const byName = Object.fromEntries(
      dataOf(posts).columns.map((c) => [c.name, c]),
    );
    expect(byName.author_id.isForeignKey).toBe(true);
    expect(byName.id.isForeignKey).toBe(false);
  });

  it('sorts columns within a table by ordinalPosition', () => {
    const columns = [
      buildColumn({ columnName: 'c', ordinalPosition: 3, isPrimary: false }),
      buildColumn({ columnName: 'a', ordinalPosition: 1, isPrimary: false }),
      buildColumn({ columnName: 'b', ordinalPosition: 2, isPrimary: false }),
    ];

    const { result } = renderHook(() =>
      useSchemaGraph({
        metadataTables: [],
        columns,
        foreignKeys: [],
        role: 'admin',
        visibleSchemas: new Set(['public']),
        hideTablesWithoutPermissions: false,
      }),
    );

    const users = result.current.nodes.find((n) => n.id === 'public.users')!;
    expect(dataOf(users).columns.map((c) => c.name)).toEqual(['a', 'b', 'c']);
  });

  it('prefers udtName over dataType for the displayed type', () => {
    const columns = [
      buildColumn({
        columnName: 'id',
        dataType: 'integer',
        udtName: 'int4',
      }),
      buildColumn({
        columnName: 'tags',
        ordinalPosition: 2,
        isPrimary: false,
        dataType: 'ARRAY',
        udtName: '',
      }),
    ];

    const { result } = renderHook(() =>
      useSchemaGraph({
        metadataTables: [],
        columns,
        foreignKeys: [],
        role: 'admin',
        visibleSchemas: new Set(['public']),
        hideTablesWithoutPermissions: false,
      }),
    );

    const users = result.current.nodes.find((n) => n.id === 'public.users')!;
    const byName = Object.fromEntries(
      dataOf(users).columns.map((c) => [c.name, c]),
    );
    expect(byName.id.dataType).toBe('int4');
    expect(byName.tags.dataType).toBe('ARRAY');
  });

  describe('per-edge relationship tracking', () => {
    const fkColumns: SchemaDiagramColumn[] = [
      buildColumn({
        schema: 'public',
        table: 'posts',
        columnName: 'author_id',
        ordinalPosition: 1,
        isPrimary: false,
      }),
      buildColumn({
        schema: 'public',
        table: 'users',
        columnName: 'id',
      }),
    ];
    const fk = buildForeignKey();

    function getEdgeData(metadataTables: HasuraMetadataTable[]): FkEdgeData {
      const { result } = renderHook(() =>
        useSchemaGraph({
          metadataTables,
          columns: fkColumns,
          foreignKeys: [fk],
          role: 'admin',
          visibleSchemas: new Set(['public']),
          hideTablesWithoutPermissions: false,
        }),
      );
      return result.current.edges[0].data as FkEdgeData;
    }

    it('marks an edge as fully tracked when both relationships exist via foreign_key_constraint_on', () => {
      const data = getEdgeData([
        buildMetadataTable('public', 'posts', {
          object_relationships: [
            {
              name: 'author',
              using: { foreign_key_constraint_on: 'author_id' },
            },
          ],
        }),
        buildMetadataTable('public', 'users', {
          array_relationships: [
            {
              name: 'posts',
              using: {
                foreign_key_constraint_on: {
                  column: 'author_id',
                  table: { schema: 'public', name: 'posts' },
                },
              },
            },
          ],
        }),
      ]);

      expect(data).toEqual({
        hasObjectRel: true,
        hasArrayRel: true,
        fromTracked: true,
        toTracked: true,
      });
    });

    it('detects only the object relationship when the array side is missing', () => {
      const data = getEdgeData([
        buildMetadataTable('public', 'posts', {
          object_relationships: [
            {
              name: 'author',
              using: { foreign_key_constraint_on: 'author_id' },
            },
          ],
        }),
        buildMetadataTable('public', 'users'),
      ]);

      expect(data.hasObjectRel).toBe(true);
      expect(data.hasArrayRel).toBe(false);
      expect(data.fromTracked).toBe(true);
      expect(data.toTracked).toBe(true);
    });

    it('detects only the array relationship when the object side is missing', () => {
      const data = getEdgeData([
        buildMetadataTable('public', 'posts'),
        buildMetadataTable('public', 'users', {
          array_relationships: [
            {
              name: 'posts',
              using: {
                foreign_key_constraint_on: {
                  column: 'author_id',
                  table: { schema: 'public', name: 'posts' },
                },
              },
            },
          ],
        }),
      ]);

      expect(data.hasObjectRel).toBe(false);
      expect(data.hasArrayRel).toBe(true);
      expect(data.fromTracked).toBe(true);
      expect(data.toTracked).toBe(true);
    });

    it('reports both sides as untracked when neither table has metadata', () => {
      const data = getEdgeData([]);

      expect(data).toEqual({
        hasObjectRel: false,
        hasArrayRel: false,
        fromTracked: false,
        toTracked: false,
      });
    });

    it('matches relationships defined via manual_configuration', () => {
      const data = getEdgeData([
        buildMetadataTable('public', 'posts', {
          object_relationships: [
            {
              name: 'author',
              using: {
                manual_configuration: {
                  remote_table: { schema: 'public', name: 'users' },
                  column_mapping: { author_id: 'id' },
                },
              },
            },
          ],
        }),
        buildMetadataTable('public', 'users', {
          array_relationships: [
            {
              name: 'posts',
              using: {
                manual_configuration: {
                  remote_table: { schema: 'public', name: 'posts' },
                  column_mapping: { id: 'author_id' },
                },
              },
            },
          ],
        }),
      ]);

      expect(data.hasObjectRel).toBe(true);
      expect(data.hasArrayRel).toBe(true);
    });

    it('uses a filled-arrow markerEnd and no markerStart when both ends are tracked', () => {
      const metadataTables = [
        buildMetadataTable('public', 'posts', {
          object_relationships: [
            {
              name: 'author',
              using: { foreign_key_constraint_on: 'author_id' },
            },
          ],
        }),
        buildMetadataTable('public', 'users', {
          array_relationships: [
            {
              name: 'posts',
              using: {
                foreign_key_constraint_on: {
                  column: 'author_id',
                  table: { schema: 'public', name: 'posts' },
                },
              },
            },
          ],
        }),
      ];
      const { result } = renderHook(() =>
        useSchemaGraph({
          metadataTables,
          columns: fkColumns,
          foreignKeys: [fk],
          role: 'admin',
          visibleSchemas: new Set(['public']),
          hideTablesWithoutPermissions: false,
        }),
      );
      const edge = result.current.edges[0];
      expect(edge.markerEnd).toBe(EDGE_MARKER_IDS.arrowFilled);
      expect(edge.markerStart).toBeUndefined();
    });

    it('switches markerEnd to hollow when the array relationship is missing', () => {
      const metadataTables = [
        buildMetadataTable('public', 'posts', {
          object_relationships: [
            {
              name: 'author',
              using: { foreign_key_constraint_on: 'author_id' },
            },
          ],
        }),
        buildMetadataTable('public', 'users'),
      ];
      const { result } = renderHook(() =>
        useSchemaGraph({
          metadataTables,
          columns: fkColumns,
          foreignKeys: [fk],
          role: 'admin',
          visibleSchemas: new Set(['public']),
          hideTablesWithoutPermissions: false,
        }),
      );
      const edge = result.current.edges[0];
      expect(edge.markerEnd).toBe(EDGE_MARKER_IDS.arrowHollow);
      expect(edge.markerStart).toBeUndefined();
    });

    it('adds a hollow-circle markerStart when the object relationship is missing', () => {
      const metadataTables = [
        buildMetadataTable('public', 'posts'),
        buildMetadataTable('public', 'users', {
          array_relationships: [
            {
              name: 'posts',
              using: {
                foreign_key_constraint_on: {
                  column: 'author_id',
                  table: { schema: 'public', name: 'posts' },
                },
              },
            },
          ],
        }),
      ];
      const { result } = renderHook(() =>
        useSchemaGraph({
          metadataTables,
          columns: fkColumns,
          foreignKeys: [fk],
          role: 'admin',
          visibleSchemas: new Set(['public']),
          hideTablesWithoutPermissions: false,
        }),
      );
      const edge = result.current.edges[0];
      expect(edge.markerStart).toBe(EDGE_MARKER_IDS.circleHollow);
      expect(edge.markerEnd).toBe(EDGE_MARKER_IDS.arrowFilled);
    });

    it('uses hollow markers on both ends when no metadata exists', () => {
      const { result } = renderHook(() =>
        useSchemaGraph({
          metadataTables: [],
          columns: fkColumns,
          foreignKeys: [fk],
          role: 'admin',
          visibleSchemas: new Set(['public']),
          hideTablesWithoutPermissions: false,
        }),
      );
      const edge = result.current.edges[0];
      expect(edge.markerStart).toBe(EDGE_MARKER_IDS.circleHollow);
      expect(edge.markerEnd).toBe(EDGE_MARKER_IDS.arrowHollow);
    });

    it('rejects foreign_key_constraint_on entries that point at a different remote table', () => {
      const data = getEdgeData([
        buildMetadataTable('public', 'posts'),
        buildMetadataTable('public', 'users', {
          array_relationships: [
            {
              name: 'something_else',
              using: {
                foreign_key_constraint_on: {
                  column: 'author_id',
                  table: { schema: 'public', name: 'comments' },
                },
              },
            },
          ],
        }),
      ]);

      expect(data.hasArrayRel).toBe(false);
    });
  });
});
