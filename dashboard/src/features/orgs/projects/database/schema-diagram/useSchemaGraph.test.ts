import type { HasuraMetadataTable } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { renderHook } from '@/tests/testUtils';
import useSchemaGraph, {
  columnHandleId,
  nodeIdFor,
  type TableNode,
  type TableNodeData,
} from './useSchemaGraph';
import type {
  SchemaDiagramColumn,
  SchemaDiagramForeignKey,
} from './useAllTableColumns';

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

    const node = result.current.nodes.find(
      (n) => n.id === 'public.untracked',
    )!;
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
    expect(edge.id).toBe(
      `${fk.constraintName}-public.posts.author_id`,
    );
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
});
