import type { HasuraMetadataTable } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { renderHook } from '@/tests/testUtils';
import type { ExportMetadataResponseMetadataSourcesItemFunctionsItem } from '@/utils/hasura-api/generated/schemas';
import { computeNodeHeight, TABLE_NODE_WIDTH } from './layout';
import type {
  SchemaDiagramColumn,
  SchemaDiagramForeignKey,
  SchemaDiagramFunctionReturnType,
} from './useAllTableColumns';
import useSchemaGraph, {
  columnHandleId,
  EDGE_MARKER_IDS,
  type FkEdgeData,
  FUNCTION_SOURCE_HANDLE_ID,
  type FunctionNode,
  functionNodeIdFor,
  type NamingMode,
  nodeIdFor,
  type SchemaDiagramNode,
  TABLE_ROW_HANDLE_ID,
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
    isGenerated: false,
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

function buildFunctionReturnType(
  overrides: Partial<SchemaDiagramFunctionReturnType> = {},
): SchemaDiagramFunctionReturnType {
  return {
    schema: 'public',
    name: 'full_name',
    returnType: 'text',
    returnsSet: false,
    ...overrides,
  };
}

function dataOf(node: SchemaDiagramNode): TableNodeData {
  return node.data as TableNodeData;
}

function functionDataOf(node: SchemaDiagramNode): FunctionNode['data'] {
  return node.data as FunctionNode['data'];
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
        tableLikeObjects: [],
        columns,
        foreignKeys: [],
        role: 'admin',
        functionReturnTypes: [],
        functionsMetadata: [],
        visibleSchemas: new Set(['public']),
        hideTablesWithoutPermissions: false,
        namingMode: 'graphql',
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
        tableLikeObjects: [],
        columns,
        foreignKeys: [],
        role: 'admin',
        functionReturnTypes: [],
        functionsMetadata: [],
        visibleSchemas: new Set(['public']),
        hideTablesWithoutPermissions: false,
        namingMode: 'graphql',
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
        tableLikeObjects: [],
        columns,
        foreignKeys: [],
        role: 'admin',
        functionReturnTypes: [],
        functionsMetadata: [],
        visibleSchemas: new Set(),
        hideTablesWithoutPermissions: false,
        namingMode: 'graphql',
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
        tableLikeObjects: [],
        columns,
        foreignKeys: [],
        role: 'admin',
        functionReturnTypes: [],
        functionsMetadata: [],
        visibleSchemas: new Set(['public']),
        hideTablesWithoutPermissions: false,
        namingMode: 'graphql',
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
        tableLikeObjects: [],
        columns,
        foreignKeys: [],
        role: 'user',
        functionReturnTypes: [],
        functionsMetadata: [],
        visibleSchemas: new Set(['public']),
        hideTablesWithoutPermissions: true,
        namingMode: 'graphql',
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
        tableLikeObjects: [],
        columns,
        foreignKeys: [],
        role: 'user',
        functionReturnTypes: [],
        functionsMetadata: [],
        visibleSchemas: new Set(['public']),
        hideTablesWithoutPermissions: false,
        namingMode: 'graphql',
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
        tableLikeObjects: [],
        columns,
        foreignKeys,
        role: 'admin',
        functionReturnTypes: [],
        functionsMetadata: [],
        visibleSchemas: new Set(['public']),
        hideTablesWithoutPermissions: false,
        namingMode: 'graphql',
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
        tableLikeObjects: [],
        columns,
        foreignKeys: [fk],
        role: 'admin',
        functionReturnTypes: [],
        functionsMetadata: [],
        visibleSchemas: new Set(['public']),
        hideTablesWithoutPermissions: false,
        namingMode: 'postgres',
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
        tableLikeObjects: [],
        columns,
        foreignKeys,
        role: 'admin',
        functionReturnTypes: [],
        functionsMetadata: [],
        visibleSchemas: new Set(['public']),
        hideTablesWithoutPermissions: false,
        namingMode: 'postgres',
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
        tableLikeObjects: [],
        columns,
        foreignKeys: [buildForeignKey()],
        role: 'admin',
        functionReturnTypes: [],
        functionsMetadata: [],
        visibleSchemas: new Set(['public']),
        hideTablesWithoutPermissions: false,
        namingMode: 'graphql',
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
        tableLikeObjects: [],
        columns,
        foreignKeys: [],
        role: 'admin',
        functionReturnTypes: [],
        functionsMetadata: [],
        visibleSchemas: new Set(['public']),
        hideTablesWithoutPermissions: false,
        namingMode: 'graphql',
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
        tableLikeObjects: [],
        columns,
        foreignKeys: [],
        role: 'admin',
        functionReturnTypes: [],
        functionsMetadata: [],
        visibleSchemas: new Set(['public']),
        hideTablesWithoutPermissions: false,
        namingMode: 'graphql',
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

    // Postgres mode emits an FK edge regardless of relationship state, so the
    // edge's data is the cleanest probe for relMatchesFk's classification.
    function getEdgeData(metadataTables: HasuraMetadataTable[]): FkEdgeData {
      const { result } = renderHook(() =>
        useSchemaGraph({
          metadataTables,
          tableLikeObjects: [],
          columns: fkColumns,
          foreignKeys: [fk],
          role: 'admin',
          functionReturnTypes: [],
          functionsMetadata: [],
          visibleSchemas: new Set(['public']),
          hideTablesWithoutPermissions: false,
          namingMode: 'postgres',
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
          tableLikeObjects: [],
          columns: fkColumns,
          foreignKeys: [fk],
          role: 'admin',
          functionReturnTypes: [],
          functionsMetadata: [],
          visibleSchemas: new Set(['public']),
          hideTablesWithoutPermissions: false,
          namingMode: 'graphql',
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
          tableLikeObjects: [],
          columns: fkColumns,
          foreignKeys: [fk],
          role: 'admin',
          functionReturnTypes: [],
          functionsMetadata: [],
          visibleSchemas: new Set(['public']),
          hideTablesWithoutPermissions: false,
          namingMode: 'graphql',
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
          tableLikeObjects: [],
          columns: fkColumns,
          foreignKeys: [fk],
          role: 'admin',
          functionReturnTypes: [],
          functionsMetadata: [],
          visibleSchemas: new Set(['public']),
          hideTablesWithoutPermissions: false,
          namingMode: 'graphql',
        }),
      );
      const edge = result.current.edges[0];
      expect(edge.markerStart).toBe(EDGE_MARKER_IDS.circleHollow);
      expect(edge.markerEnd).toBe(EDGE_MARKER_IDS.arrowFilled);
    });

    it('uses hollow markers on both ends when no metadata exists (postgres mode)', () => {
      const { result } = renderHook(() =>
        useSchemaGraph({
          metadataTables: [],
          tableLikeObjects: [],
          columns: fkColumns,
          foreignKeys: [fk],
          role: 'admin',
          functionReturnTypes: [],
          functionsMetadata: [],
          visibleSchemas: new Set(['public']),
          hideTablesWithoutPermissions: false,
          namingMode: 'postgres',
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

  describe('GraphQL-mode edges', () => {
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

    function renderGraphqlGraph(
      metadataTables: HasuraMetadataTable[],
      foreignKeys: SchemaDiagramForeignKey[] = [buildForeignKey()],
      extraColumns: SchemaDiagramColumn[] = [],
    ) {
      return renderHook(() =>
        useSchemaGraph({
          metadataTables,
          tableLikeObjects: [],
          columns: [...fkColumns, ...extraColumns],
          foreignKeys,
          role: 'admin',
          functionReturnTypes: [],
          functionsMetadata: [],
          visibleSchemas: new Set(['public']),
          hideTablesWithoutPermissions: false,
          namingMode: 'graphql',
        }),
      );
    }

    it('hides FK edges that have no tracked relationship', () => {
      const { result } = renderGraphqlGraph([
        buildMetadataTable('public', 'posts'),
        buildMetadataTable('public', 'users'),
      ]);

      expect(result.current.edges).toEqual([]);
    });

    it('keeps FK edges that have at least one tracked relationship', () => {
      const { result } = renderGraphqlGraph([
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

      expect(result.current.edges).toHaveLength(1);
      const data = result.current.edges[0].data as FkEdgeData;
      expect(data.hasObjectRel).toBe(true);
      expect(data.hasArrayRel).toBe(false);
    });

    it('emits a synthetic edge for a manual object relationship not backed by an FK', () => {
      const extraColumns: SchemaDiagramColumn[] = [
        buildColumn({
          schema: 'public',
          table: 'comments',
          columnName: 'commenter_email',
          ordinalPosition: 1,
          isPrimary: false,
        }),
        buildColumn({
          schema: 'public',
          table: 'users',
          columnName: 'email',
          ordinalPosition: 2,
          isPrimary: false,
        }),
      ];
      const { result } = renderGraphqlGraph(
        [
          buildMetadataTable('public', 'comments', {
            object_relationships: [
              {
                name: 'commenter',
                using: {
                  manual_configuration: {
                    remote_table: { schema: 'public', name: 'users' },
                    column_mapping: { commenter_email: 'email' },
                  },
                },
              },
            ],
          }),
          buildMetadataTable('public', 'users'),
        ],
        [],
        extraColumns,
      );

      const manualEdge = result.current.edges.find(
        (e) => e.source === nodeIdFor('public', 'comments'),
      );
      expect(manualEdge).toBeDefined();
      expect(manualEdge?.sourceHandle).toBe(
        columnHandleId('source', 'commenter_email'),
      );
      expect(manualEdge?.targetHandle).toBe(columnHandleId('target', 'email'));
      const data = manualEdge?.data as FkEdgeData;
      expect(data.hasObjectRel).toBe(true);
      expect(data.hasArrayRel).toBe(false);
    });

    it('emits a synthetic edge for a manual array relationship and maps direction from remote→local', () => {
      const extraColumns: SchemaDiagramColumn[] = [
        buildColumn({
          schema: 'public',
          table: 'sessions',
          columnName: 'owner_email',
          ordinalPosition: 1,
          isPrimary: false,
        }),
        buildColumn({
          schema: 'public',
          table: 'users',
          columnName: 'email',
          ordinalPosition: 2,
          isPrimary: false,
        }),
      ];
      const { result } = renderGraphqlGraph(
        [
          buildMetadataTable('public', 'users', {
            array_relationships: [
              {
                name: 'sessions',
                using: {
                  manual_configuration: {
                    remote_table: { schema: 'public', name: 'sessions' },
                    column_mapping: { email: 'owner_email' },
                  },
                },
              },
            ],
          }),
          buildMetadataTable('public', 'sessions'),
        ],
        [],
        extraColumns,
      );

      const arrayEdge = result.current.edges.find(
        (e) => e.source === nodeIdFor('public', 'sessions'),
      );
      expect(arrayEdge).toBeDefined();
      expect(arrayEdge?.target).toBe(nodeIdFor('public', 'users'));
      expect(arrayEdge?.sourceHandle).toBe(
        columnHandleId('source', 'owner_email'),
      );
      expect(arrayEdge?.targetHandle).toBe(columnHandleId('target', 'email'));
      const data = arrayEdge?.data as FkEdgeData;
      expect(data.hasObjectRel).toBe(false);
      expect(data.hasArrayRel).toBe(true);
    });

    it('does not duplicate when a manual rel matches an existing FK-tracked edge', () => {
      const { result } = renderGraphqlGraph([
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
              name: 'posts_manual',
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

      expect(result.current.edges).toHaveLength(1);
      const data = result.current.edges[0].data as FkEdgeData;
      expect(data.hasObjectRel).toBe(true);
      expect(data.hasArrayRel).toBe(true);
    });
  });

  describe('computed fields', () => {
    it('maps metadataTable.computed_fields and resolves return types from functionReturnTypes', () => {
      const columns = [buildColumn({ schema: 'public', table: 'users' })];
      const metadataTables = [
        buildMetadataTable('public', 'users', {
          computed_fields: [
            {
              name: 'full_name',
              definition: {
                function: { schema: 'public', name: 'users_full_name' },
              },
            },
          ],
        }),
      ];

      const { result } = renderHook(() =>
        useSchemaGraph({
          metadataTables,
          tableLikeObjects: [],
          columns,
          foreignKeys: [],
          role: 'admin',
          functionReturnTypes: [
            buildFunctionReturnType({
              schema: 'public',
              name: 'users_full_name',
              returnType: 'text',
              returnsSet: false,
            }),
          ],
          functionsMetadata: [],
          visibleSchemas: new Set(['public']),
          hideTablesWithoutPermissions: false,
          namingMode: 'graphql',
        }),
      );

      const node = result.current.nodes.find((n) => n.id === 'public.users')!;
      expect(dataOf(node).computedFields).toEqual([
        {
          name: 'full_name',
          returnType: 'text',
          functionSchema: 'public',
          functionName: 'users_full_name',
        },
      ]);
    });

    it('prefixes "setof " when the resolved function returns a set', () => {
      const metadataTables = [
        buildMetadataTable('public', 'users', {
          computed_fields: [
            {
              name: 'posts',
              definition: {
                function: { schema: 'public', name: 'posts_for_user' },
              },
            },
          ],
        }),
      ];

      const { result } = renderHook(() =>
        useSchemaGraph({
          metadataTables,
          tableLikeObjects: [],
          columns: [buildColumn({ schema: 'public', table: 'users' })],
          foreignKeys: [],
          role: 'admin',
          functionReturnTypes: [
            buildFunctionReturnType({
              schema: 'public',
              name: 'posts_for_user',
              returnType: 'public.posts',
              returnsSet: true,
            }),
          ],
          functionsMetadata: [],
          visibleSchemas: new Set(['public']),
          hideTablesWithoutPermissions: false,
          namingMode: 'graphql',
        }),
      );

      const node = result.current.nodes.find((n) => n.id === 'public.users')!;
      expect(dataOf(node).computedFields[0].returnType).toBe(
        'setof public.posts',
      );
    });

    it('returns returnType: undefined when no matching functionReturnTypes entry exists', () => {
      const metadataTables = [
        buildMetadataTable('public', 'users', {
          computed_fields: [
            {
              name: 'full_name',
              definition: {
                function: { schema: 'public', name: 'users_full_name' },
              },
            },
          ],
        }),
      ];

      const { result } = renderHook(() =>
        useSchemaGraph({
          metadataTables,
          tableLikeObjects: [],
          columns: [buildColumn({ schema: 'public', table: 'users' })],
          foreignKeys: [],
          role: 'admin',
          functionReturnTypes: [],
          functionsMetadata: [],
          visibleSchemas: new Set(['public']),
          hideTablesWithoutPermissions: false,
          namingMode: 'graphql',
        }),
      );

      const node = result.current.nodes.find((n) => n.id === 'public.users')!;
      expect(dataOf(node).computedFields[0].returnType).toBeUndefined();
    });

    it('sizes node height by columns + computedFields', () => {
      const columns = [
        buildColumn({ schema: 'public', table: 'users', columnName: 'id' }),
        buildColumn({
          schema: 'public',
          table: 'users',
          columnName: 'email',
          ordinalPosition: 2,
          isPrimary: false,
        }),
      ];
      const metadataTables = [
        buildMetadataTable('public', 'users', {
          computed_fields: [
            {
              name: 'full_name',
              definition: {
                function: { schema: 'public', name: 'users_full_name' },
              },
            },
            {
              name: 'posts_count',
              definition: {
                function: { schema: 'public', name: 'users_posts_count' },
              },
            },
          ],
        }),
      ];

      const { result } = renderHook(() =>
        useSchemaGraph({
          metadataTables,
          tableLikeObjects: [],
          columns,
          foreignKeys: [],
          role: 'admin',
          functionReturnTypes: [],
          functionsMetadata: [],
          visibleSchemas: new Set(['public']),
          hideTablesWithoutPermissions: false,
          namingMode: 'graphql',
        }),
      );

      const node = result.current.nodes.find((n) => n.id === 'public.users')!;
      expect(node.initialHeight).toBe(computeNodeHeight(4));
    });

    it('drops computed fields and sizes by columns only in postgres mode', () => {
      const columns = [
        buildColumn({ schema: 'public', table: 'users', columnName: 'id' }),
      ];
      const metadataTables = [
        buildMetadataTable('public', 'users', {
          computed_fields: [
            {
              name: 'full_name',
              definition: {
                function: { schema: 'public', name: 'users_full_name' },
              },
            },
          ],
        }),
      ];

      const { result } = renderHook(() =>
        useSchemaGraph({
          metadataTables,
          tableLikeObjects: [],
          columns,
          foreignKeys: [],
          role: 'admin',
          functionReturnTypes: [],
          functionsMetadata: [],
          visibleSchemas: new Set(['public']),
          hideTablesWithoutPermissions: false,
          namingMode: 'postgres',
        }),
      );

      const node = result.current.nodes.find((n) => n.id === 'public.users')!;
      expect(dataOf(node).computedFields).toEqual([]);
      expect(node.initialHeight).toBe(computeNodeHeight(1));
    });
  });

  describe('graphql naming overrides', () => {
    it('exposes table and column custom_name from configuration.column_config', () => {
      const columns = [
        buildColumn({
          schema: 'public',
          table: 'users',
          columnName: 'email',
          isPrimary: false,
        }),
      ];
      const metadataTables = [
        buildMetadataTable('public', 'users', {
          configuration: {
            custom_name: 'User',
            column_config: { email: { custom_name: 'emailAddress' } },
          },
          // biome-ignore lint/suspicious/noExplicitAny: configuration uses loosely-typed Record in the metadata type
        } as any),
      ];

      const { result } = renderHook(() =>
        useSchemaGraph({
          metadataTables,
          tableLikeObjects: [],
          columns,
          foreignKeys: [],
          role: 'admin',
          functionReturnTypes: [],
          functionsMetadata: [],
          visibleSchemas: new Set(['public']),
          hideTablesWithoutPermissions: false,
          namingMode: 'graphql',
        }),
      );

      const node = result.current.nodes.find((n) => n.id === 'public.users')!;
      expect(dataOf(node).tableGraphqlName).toBe('User');
      expect(dataOf(node).columns[0].graphqlName).toBe('emailAddress');
    });

    it('falls back to deprecated custom_column_names', () => {
      const columns = [
        buildColumn({
          schema: 'public',
          table: 'users',
          columnName: 'email',
          isPrimary: false,
        }),
      ];
      const metadataTables = [
        buildMetadataTable('public', 'users', {
          configuration: {
            custom_column_names: { email: 'emailAddress' },
          },
          // biome-ignore lint/suspicious/noExplicitAny: configuration uses loosely-typed Record in the metadata type
        } as any),
      ];

      const { result } = renderHook(() =>
        useSchemaGraph({
          metadataTables,
          tableLikeObjects: [],
          columns,
          foreignKeys: [],
          role: 'admin',
          functionReturnTypes: [],
          functionsMetadata: [],
          visibleSchemas: new Set(['public']),
          hideTablesWithoutPermissions: false,
          namingMode: 'graphql',
        }),
      );

      const node = result.current.nodes.find((n) => n.id === 'public.users')!;
      expect(dataOf(node).columns[0].graphqlName).toBe('emailAddress');
    });
  });

  describe('objectType', () => {
    it('maps each table_type from tableLikeObjects onto its node', () => {
      const columns = [
        buildColumn({ schema: 'public', table: 'users' }),
        buildColumn({ schema: 'public', table: 'active_users' }),
        buildColumn({ schema: 'public', table: 'daily_metrics' }),
      ];

      const { result } = renderHook(() =>
        useSchemaGraph({
          metadataTables: [],
          tableLikeObjects: [
            {
              table_schema: 'public',
              table_name: 'users',
              table_type: 'ORDINARY TABLE',
              updatability: 1,
            },
            {
              table_schema: 'public',
              table_name: 'active_users',
              table_type: 'VIEW',
              updatability: 0,
            },
            {
              table_schema: 'public',
              table_name: 'daily_metrics',
              table_type: 'MATERIALIZED VIEW',
              updatability: 0,
            },
          ],
          columns,
          foreignKeys: [],
          role: 'admin',
          functionReturnTypes: [],
          functionsMetadata: [],
          visibleSchemas: new Set(['public']),
          hideTablesWithoutPermissions: false,
          namingMode: 'graphql',
        }),
      );

      const byId = Object.fromEntries(
        result.current.nodes.map((n) => [n.id, dataOf(n).objectType]),
      );
      expect(byId['public.users']).toBe('ORDINARY TABLE');
      expect(byId['public.active_users']).toBe('VIEW');
      expect(byId['public.daily_metrics']).toBe('MATERIALIZED VIEW');
    });

    it("defaults to 'ORDINARY TABLE' for nodes with no matching tableLikeObjects entry", () => {
      const columns = [buildColumn({ schema: 'public', table: 'orphan' })];

      const { result } = renderHook(() =>
        useSchemaGraph({
          metadataTables: [],
          tableLikeObjects: [],
          columns,
          foreignKeys: [],
          role: 'admin',
          functionReturnTypes: [],
          functionsMetadata: [],
          visibleSchemas: new Set(['public']),
          hideTablesWithoutPermissions: false,
          namingMode: 'graphql',
        }),
      );

      const node = result.current.nodes.find((n) => n.id === 'public.orphan')!;
      expect(dataOf(node).objectType).toBe('ORDINARY TABLE');
    });
  });

  describe('set-returning function nodes', () => {
    const usersColumns: SchemaDiagramColumn[] = [
      buildColumn({ schema: 'public', table: 'users', columnName: 'id' }),
    ];

    function buildFunctionMetadata(
      schema: string,
      name: string,
      configuration?: ExportMetadataResponseMetadataSourcesItemFunctionsItem['configuration'],
    ): ExportMetadataResponseMetadataSourcesItemFunctionsItem {
      return { function: { schema, name }, configuration };
    }

    function renderWithFunction(
      overrides: {
        fn?: Partial<SchemaDiagramFunctionReturnType>;
        functionsMetadata?: ExportMetadataResponseMetadataSourcesItemFunctionsItem[];
        metadataTables?: HasuraMetadataTable[];
        visibleSchemas?: Set<string>;
        namingMode?: NamingMode;
      } = {},
    ) {
      return renderHook(() =>
        useSchemaGraph({
          metadataTables: overrides.metadataTables ?? [],
          tableLikeObjects: [],
          columns: usersColumns,
          foreignKeys: [],
          functionReturnTypes: [
            buildFunctionReturnType({
              schema: 'public',
              name: 'find_users',
              returnType: 'public.users',
              returnsSet: true,
              returnSchema: 'public',
              returnTable: 'users',
              ...overrides.fn,
            }),
          ],
          functionsMetadata: overrides.functionsMetadata ?? [],
          role: 'admin',
          visibleSchemas: overrides.visibleSchemas ?? new Set(['public']),
          hideTablesWithoutPermissions: false,
          namingMode: overrides.namingMode ?? 'graphql',
        }),
      );
    }

    function findFunctionNode(nodes: SchemaDiagramNode[]): SchemaDiagramNode {
      const node = nodes.find((n) => n.type === 'functionNode');
      if (!node) {
        throw new Error('expected a function node');
      }
      return node;
    }

    it('renders a function node and an edge to the table it returns SETOF', () => {
      const { result } = renderWithFunction();

      const fnNode = findFunctionNode(result.current.nodes);
      expect(fnNode.id).toBe(functionNodeIdFor('public', 'find_users'));
      expect(functionDataOf(fnNode).returnTablePostgres).toBe('users');

      const fnEdge = result.current.edges.find((e) => e.data?.isFunctionEdge);
      expect(fnEdge).toBeDefined();
      expect(fnEdge?.source).toBe(functionNodeIdFor('public', 'find_users'));
      expect(fnEdge?.target).toBe(nodeIdFor('public', 'users'));
      expect(fnEdge?.sourceHandle).toBe(FUNCTION_SOURCE_HANDLE_ID);
      expect(fnEdge?.targetHandle).toBe(TABLE_ROW_HANDLE_ID);
      // Distinct double-chevron marker, and a solid line (no dash) so it is not
      // confused with a selected/animated edge.
      expect(fnEdge?.markerEnd).toBe(EDGE_MARKER_IDS.functionArrow);
      expect(fnEdge?.style?.strokeDasharray).toBeUndefined();
    });

    it('does not add a node for functions that do not return a set', () => {
      const { result } = renderWithFunction({ fn: { returnsSet: false } });

      expect(result.current.nodes.some((n) => n.type === 'functionNode')).toBe(
        false,
      );
      expect(result.current.edges.some((e) => e.data?.isFunctionEdge)).toBe(
        false,
      );
    });

    it('does not add a node when the return type is not a table (e.g. SETOF record)', () => {
      const { result } = renderWithFunction({
        fn: {
          returnType: 'record',
          returnSchema: undefined,
          returnTable: undefined,
        },
      });

      expect(result.current.nodes.some((n) => n.type === 'functionNode')).toBe(
        false,
      );
    });

    it('skips the function when its return table is not a visible node', () => {
      const { result } = renderWithFunction({
        fn: { returnSchema: 'private', returnTable: 'secrets' },
      });

      expect(result.current.nodes.some((n) => n.type === 'functionNode')).toBe(
        false,
      );
      expect(result.current.edges.some((e) => e.data?.isFunctionEdge)).toBe(
        false,
      );
    });

    it('hides the function node when its own schema is not visible', () => {
      const { result } = renderWithFunction({
        fn: { schema: 'analytics' },
        visibleSchemas: new Set(['public']),
      });

      expect(result.current.nodes.some((n) => n.type === 'functionNode')).toBe(
        false,
      );
    });

    it('marks the function node untracked when absent from functionsMetadata', () => {
      const { result } = renderWithFunction({ functionsMetadata: [] });

      expect(
        functionDataOf(findFunctionNode(result.current.nodes)).isUntracked,
      ).toBe(true);
    });

    it('marks the function node tracked when present in functionsMetadata', () => {
      const { result } = renderWithFunction({
        functionsMetadata: [buildFunctionMetadata('public', 'find_users')],
      });

      expect(
        functionDataOf(findFunctionNode(result.current.nodes)).isUntracked,
      ).toBe(false);
    });

    it('renders the function node in postgres mode as well', () => {
      const { result } = renderWithFunction({ namingMode: 'postgres' });

      expect(result.current.nodes.some((n) => n.type === 'functionNode')).toBe(
        true,
      );
    });

    it('resolves the GraphQL root-field name and the return table GraphQL name', () => {
      const { result } = renderWithFunction({
        functionsMetadata: [
          buildFunctionMetadata('public', 'find_users', {
            custom_root_fields: { function: 'findUsers' },
          }),
        ],
        metadataTables: [
          buildMetadataTable('public', 'users', {
            configuration: { custom_name: 'User' },
            // biome-ignore lint/suspicious/noExplicitAny: configuration uses a loosely-typed Record in the metadata type
          } as any),
        ],
      });

      const data = functionDataOf(findFunctionNode(result.current.nodes));
      expect(data.graphqlName).toBe('findUsers');
      expect(data.returnTableGraphql).toBe('User');
    });

    it('falls back to custom_name when no custom root field is set', () => {
      const { result } = renderWithFunction({
        functionsMetadata: [
          buildFunctionMetadata('public', 'find_users', {
            custom_name: 'usersSearch',
          }),
        ],
      });

      expect(
        functionDataOf(findFunctionNode(result.current.nodes)).graphqlName,
      ).toBe('usersSearch');
    });

    it('sizes the function node as a single row and matches the table node width', () => {
      const { result } = renderWithFunction();

      const fnNode = findFunctionNode(result.current.nodes);
      expect(fnNode.initialHeight).toBe(computeNodeHeight(1));
      expect(fnNode.initialWidth).toBe(TABLE_NODE_WIDTH);
    });
  });

  describe('layout stability across naming modes', () => {
    it('positions tables identically in postgres and graphql modes so the GraphQL-view toggle never moves them', () => {
      const columns: SchemaDiagramColumn[] = [
        buildColumn({ schema: 'public', table: 'users', columnName: 'id' }),
        buildColumn({
          schema: 'public',
          table: 'users',
          columnName: 'email',
          ordinalPosition: 2,
          isPrimary: false,
        }),
        buildColumn({ schema: 'public', table: 'posts', columnName: 'id' }),
        buildColumn({
          schema: 'public',
          table: 'posts',
          columnName: 'author_id',
          ordinalPosition: 2,
          isPrimary: false,
        }),
        buildColumn({ schema: 'public', table: 'comments', columnName: 'id' }),
        buildColumn({
          schema: 'public',
          table: 'comments',
          columnName: 'post_id',
          ordinalPosition: 2,
          isPrimary: false,
        }),
      ];
      const foreignKeys: SchemaDiagramForeignKey[] = [
        buildForeignKey({
          fromTable: 'posts',
          fromColumn: 'author_id',
          toTable: 'users',
          toColumn: 'id',
          constraintName: 'posts_author_id_fkey',
        }),
        buildForeignKey({
          fromTable: 'comments',
          fromColumn: 'post_id',
          toTable: 'posts',
          toColumn: 'id',
          constraintName: 'comments_post_id_fkey',
        }),
      ];
      const metadataTables: HasuraMetadataTable[] = [
        buildMetadataTable('public', 'users', {
          computed_fields: [
            {
              name: 'full_name',
              definition: {
                function: { schema: 'public', name: 'users_full_name' },
              },
            },
          ],
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
        buildMetadataTable('public', 'posts', {
          object_relationships: [
            {
              name: 'author',
              using: { foreign_key_constraint_on: 'author_id' },
            },
          ],
        }),
        buildMetadataTable('public', 'comments'),
      ];

      const baseInput = {
        metadataTables,
        tableLikeObjects: [],
        columns,
        foreignKeys,
        role: 'admin',
        functionReturnTypes: [
          buildFunctionReturnType({
            schema: 'public',
            name: 'users_full_name',
            returnType: 'text',
          }),
        ],
        functionsMetadata: [],
        visibleSchemas: new Set(['public']),
        hideTablesWithoutPermissions: false,
      };

      const graphql = renderHook(() =>
        useSchemaGraph({ ...baseInput, namingMode: 'graphql' }),
      );
      const postgres = renderHook(() =>
        useSchemaGraph({ ...baseInput, namingMode: 'postgres' }),
      );

      const positionsByMode = (r: typeof graphql) =>
        Object.fromEntries(
          r.result.current.nodes.map((n) => [n.id, n.position]),
        );

      expect(positionsByMode(graphql)).toEqual(positionsByMode(postgres));
      expect(graphql.result.current.edges.length).not.toBe(
        postgres.result.current.edges.length,
      );
    });
  });
});
