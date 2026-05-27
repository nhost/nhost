import type { Edge, Node } from '@xyflow/react';
import { useMemo } from 'react';
import type {
  HasuraMetadataRelationship,
  HasuraMetadataTable,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { computeNodeHeight, layoutNodes, TABLE_NODE_WIDTH } from './layout';
import { tableHasAnyPermission } from './permissionState';
import type {
  SchemaDiagramColumn,
  SchemaDiagramForeignKey,
  SchemaDiagramFunctionReturnType,
} from './useAllTableColumns';

export type NamingMode = 'postgres' | 'graphql';

export interface TableNodeColumn {
  name: string;
  graphqlName: string | undefined;
  dataType: string;
  isNullable: boolean;
  isPrimary: boolean;
  isForeignKey: boolean;
  isGenerated: boolean;
}

export interface TableNodeComputedField {
  name: string;
  returnType: string | undefined;
  functionSchema: string;
  functionName: string;
}

export interface TableNodeData extends Record<string, unknown> {
  schema: string;
  table: string;
  tableGraphqlName: string | undefined;
  columns: TableNodeColumn[];
  computedFields: TableNodeComputedField[];
  metadataTable: HasuraMetadataTable | undefined;
  role: string;
  namingMode: NamingMode;
}

export type TableNode = Node<TableNodeData, 'tableNode'>;

export interface UseSchemaGraphInput {
  metadataTables: HasuraMetadataTable[];
  columns: SchemaDiagramColumn[];
  foreignKeys: SchemaDiagramForeignKey[];
  functionReturnTypes: SchemaDiagramFunctionReturnType[];
  role: string;
  visibleSchemas: Set<string>;
  hideTablesWithoutPermissions: boolean;
  namingMode: NamingMode;
}

export interface UseSchemaGraphResult {
  nodes: TableNode[];
  edges: Edge[];
  totalTableCount: number;
}

export function nodeIdFor(schema: string, table: string): string {
  return `${schema}.${table}`;
}

export function columnHandleId(
  side: 'source' | 'target',
  column: string,
): string {
  return `${side}-${column}`;
}

export interface FkEdgeData extends Record<string, unknown> {
  hasObjectRel: boolean;
  hasArrayRel: boolean;
  fromTracked: boolean;
  toTracked: boolean;
}

export const EDGE_MARKER_IDS = {
  arrowFilled: 'schema-diagram-arrow-filled',
  arrowHollow: 'schema-diagram-arrow-hollow',
  circleHollow: 'schema-diagram-circle-hollow',
} as const;

function edgeKey(
  fromId: string,
  fromCol: string,
  toId: string,
  toCol: string,
): string {
  return `${fromId}.${fromCol}->${toId}.${toCol}`;
}

interface EdgeSpec {
  id: string;
  fromId: string;
  fromCol: string;
  toId: string;
  toCol: string;
  hasObjectRel: boolean;
  hasArrayRel: boolean;
  fromTracked: boolean;
  toTracked: boolean;
}

function specToEdge(spec: EdgeSpec): Edge {
  const data: FkEdgeData = {
    hasObjectRel: spec.hasObjectRel,
    hasArrayRel: spec.hasArrayRel,
    fromTracked: spec.fromTracked,
    toTracked: spec.toTracked,
  };
  return {
    id: spec.id,
    source: spec.fromId,
    target: spec.toId,
    sourceHandle: columnHandleId('source', spec.fromCol),
    targetHandle: columnHandleId('target', spec.toCol),
    type: 'smart',
    data,
    markerStart: spec.hasObjectRel ? undefined : EDGE_MARKER_IDS.circleHollow,
    markerEnd: spec.hasArrayRel
      ? EDGE_MARKER_IDS.arrowFilled
      : EDGE_MARKER_IDS.arrowHollow,
  };
}

function buildPostgresEdges(
  foreignKeys: SchemaDiagramForeignKey[],
  metadataByTableId: Map<string, HasuraMetadataTable>,
  visibleNodeIds: Set<string>,
): Edge[] {
  return foreignKeys
    .filter((fk) => {
      const fromId = nodeIdFor(fk.fromSchema, fk.fromTable);
      const toId = nodeIdFor(fk.toSchema, fk.toTable);
      return visibleNodeIds.has(fromId) && visibleNodeIds.has(toId);
    })
    .map((fk) => {
      const fromId = nodeIdFor(fk.fromSchema, fk.fromTable);
      const toId = nodeIdFor(fk.toSchema, fk.toTable);
      const sourceMeta = metadataByTableId.get(fromId);
      const targetMeta = metadataByTableId.get(toId);
      return specToEdge({
        id: `${fk.constraintName}-${fk.fromSchema}.${fk.fromTable}.${fk.fromColumn}`,
        fromId,
        fromCol: fk.fromColumn,
        toId,
        toCol: fk.toColumn,
        hasObjectRel: !!sourceMeta?.object_relationships?.some((r) =>
          relMatchesFk(r, fk, 'object'),
        ),
        hasArrayRel: !!targetMeta?.array_relationships?.some((r) =>
          relMatchesFk(r, fk, 'array'),
        ),
        fromTracked: !!sourceMeta,
        toTracked: !!targetMeta,
      });
    });
}

function buildGraphqlEdges(
  foreignKeys: SchemaDiagramForeignKey[],
  metadataTables: HasuraMetadataTable[],
  metadataByTableId: Map<string, HasuraMetadataTable>,
  visibleNodeIds: Set<string>,
): Edge[] {
  const specByKey = new Map<string, EdgeSpec>();

  for (const fk of foreignKeys) {
    const fromId = nodeIdFor(fk.fromSchema, fk.fromTable);
    const toId = nodeIdFor(fk.toSchema, fk.toTable);
    if (!visibleNodeIds.has(fromId) || !visibleNodeIds.has(toId)) {
      continue;
    }
    const sourceMeta = metadataByTableId.get(fromId);
    const targetMeta = metadataByTableId.get(toId);
    const hasObjectRel = !!sourceMeta?.object_relationships?.some((r) =>
      relMatchesFk(r, fk, 'object'),
    );
    const hasArrayRel = !!targetMeta?.array_relationships?.some((r) =>
      relMatchesFk(r, fk, 'array'),
    );
    if (!hasObjectRel && !hasArrayRel) {
      continue;
    }
    const key = edgeKey(fromId, fk.fromColumn, toId, fk.toColumn);
    specByKey.set(key, {
      id: `${fk.constraintName}-${fk.fromSchema}.${fk.fromTable}.${fk.fromColumn}`,
      fromId,
      fromCol: fk.fromColumn,
      toId,
      toCol: fk.toColumn,
      hasObjectRel,
      hasArrayRel,
      fromTracked: !!sourceMeta,
      toTracked: !!targetMeta,
    });
  }

  // For object rels the canonical direction is local→remote; for array rels
  // it's remote→local.
  for (const meta of metadataTables) {
    const localId = nodeIdFor(meta.table.schema, meta.table.name);
    if (!visibleNodeIds.has(localId)) {
      continue;
    }

    for (const rel of meta.object_relationships ?? []) {
      const manual = rel.using.manual_configuration;
      if (!manual) {
        continue;
      }
      const remoteId = nodeIdFor(
        manual.remote_table.schema,
        manual.remote_table.name,
      );
      if (!visibleNodeIds.has(remoteId)) {
        continue;
      }
      for (const [fromCol, toCol] of Object.entries(manual.column_mapping)) {
        const key = edgeKey(localId, fromCol, remoteId, toCol);
        const existing = specByKey.get(key);
        if (existing) {
          existing.hasObjectRel = true;
        } else {
          specByKey.set(key, {
            id: `manual-${localId}.${fromCol}->${remoteId}.${toCol}`,
            fromId: localId,
            fromCol,
            toId: remoteId,
            toCol,
            hasObjectRel: true,
            hasArrayRel: false,
            fromTracked: true,
            toTracked: !!metadataByTableId.get(remoteId),
          });
        }
      }
    }

    for (const rel of meta.array_relationships ?? []) {
      const manual = rel.using.manual_configuration;
      if (!manual) {
        continue;
      }
      const remoteId = nodeIdFor(
        manual.remote_table.schema,
        manual.remote_table.name,
      );
      if (!visibleNodeIds.has(remoteId)) {
        continue;
      }
      // For an array rel, the remote table holds the "FK" side; mapping keys
      // are columns on the local (referenced) table, values are columns on
      // the remote (referring) table.
      for (const [localCol, remoteCol] of Object.entries(
        manual.column_mapping,
      )) {
        const key = edgeKey(remoteId, remoteCol, localId, localCol);
        const existing = specByKey.get(key);
        if (existing) {
          existing.hasArrayRel = true;
        } else {
          specByKey.set(key, {
            id: `manual-${remoteId}.${remoteCol}->${localId}.${localCol}`,
            fromId: remoteId,
            fromCol: remoteCol,
            toId: localId,
            toCol: localCol,
            hasObjectRel: false,
            hasArrayRel: true,
            fromTracked: !!metadataByTableId.get(remoteId),
            toTracked: true,
          });
        }
      }
    }
  }

  return Array.from(specByKey.values()).map(specToEdge);
}

function relMatchesFk(
  rel: HasuraMetadataRelationship,
  fk: SchemaDiagramForeignKey,
  side: 'object' | 'array',
): boolean {
  const using = rel.using;
  if (using.foreign_key_constraint_on !== undefined) {
    const fkc = using.foreign_key_constraint_on;
    if (side === 'object') {
      return typeof fkc === 'string' && fkc === fk.fromColumn;
    }
    return (
      typeof fkc === 'object' &&
      fkc.column === fk.fromColumn &&
      fkc.table.schema === fk.fromSchema &&
      fkc.table.name === fk.fromTable
    );
  }
  const manual = using.manual_configuration;
  if (!manual) {
    return false;
  }
  const remoteMatches =
    side === 'object'
      ? manual.remote_table.schema === fk.toSchema &&
        manual.remote_table.name === fk.toTable
      : manual.remote_table.schema === fk.fromSchema &&
        manual.remote_table.name === fk.fromTable;
  if (!remoteMatches) {
    return false;
  }
  if (side === 'object') {
    return manual.column_mapping[fk.fromColumn] === fk.toColumn;
  }
  return manual.column_mapping[fk.toColumn] === fk.fromColumn;
}

interface TableConfiguration {
  custom_name?: unknown;
  column_config?: Record<string, { custom_name?: unknown } | undefined>;
  custom_column_names?: Record<string, unknown>;
}

function readTableGraphqlName(
  metadataTable: HasuraMetadataTable | undefined,
): string | undefined {
  const config = metadataTable?.configuration as TableConfiguration | undefined;
  const customName = config?.custom_name;
  return typeof customName === 'string' && customName.length > 0
    ? customName
    : undefined;
}

function readColumnGraphqlName(
  metadataTable: HasuraMetadataTable | undefined,
  columnName: string,
): string | undefined {
  const config = metadataTable?.configuration as TableConfiguration | undefined;
  const fromColumnConfig = config?.column_config?.[columnName]?.custom_name;
  if (typeof fromColumnConfig === 'string' && fromColumnConfig.length > 0) {
    return fromColumnConfig;
  }
  const fromCustomColumnNames = config?.custom_column_names?.[columnName];
  if (
    typeof fromCustomColumnNames === 'string' &&
    fromCustomColumnNames.length > 0
  ) {
    return fromCustomColumnNames;
  }
  return undefined;
}

export default function useSchemaGraph({
  metadataTables,
  columns,
  foreignKeys,
  functionReturnTypes,
  role,
  visibleSchemas,
  hideTablesWithoutPermissions,
  namingMode,
}: UseSchemaGraphInput): UseSchemaGraphResult {
  return useMemo(() => {
    const columnsByTable = new Map<string, SchemaDiagramColumn[]>();

    for (const col of columns) {
      const id = nodeIdFor(col.schema, col.table);
      const list = columnsByTable.get(id) ?? [];
      list.push(col);
      columnsByTable.set(id, list);
    }

    for (const sorted of columnsByTable.values()) {
      sorted.sort((a, b) => a.ordinalPosition - b.ordinalPosition);
    }

    const returnTypeByFunctionId = new Map<string, string>();
    for (const fn of functionReturnTypes) {
      const id = `${fn.schema}.${fn.name}`;
      returnTypeByFunctionId.set(
        id,
        fn.returnsSet ? `setof ${fn.returnType}` : fn.returnType,
      );
    }

    const foreignKeyColumnsByTable = new Map<string, Set<string>>();
    for (const fk of foreignKeys) {
      const id = nodeIdFor(fk.fromSchema, fk.fromTable);
      const set = foreignKeyColumnsByTable.get(id) ?? new Set<string>();
      set.add(fk.fromColumn);
      foreignKeyColumnsByTable.set(id, set);
    }

    const metadataByTableId = new Map<string, HasuraMetadataTable>();
    for (const t of metadataTables) {
      metadataByTableId.set(nodeIdFor(t.table.schema, t.table.name), t);
    }

    const tableIdentByNodeId = new Map<
      string,
      { schema: string; table: string }
    >();
    for (const col of columns) {
      const id = nodeIdFor(col.schema, col.table);
      if (!tableIdentByNodeId.has(id)) {
        tableIdentByNodeId.set(id, { schema: col.schema, table: col.table });
      }
    }
    for (const t of metadataTables) {
      const id = nodeIdFor(t.table.schema, t.table.name);
      if (!tableIdentByNodeId.has(id)) {
        tableIdentByNodeId.set(id, {
          schema: t.table.schema,
          table: t.table.name,
        });
      }
    }

    const totalTableCount = tableIdentByNodeId.size;

    const visibleNodeIds = new Set<string>();

    const nodes: TableNode[] = [];
    for (const [id, { schema, table }] of tableIdentByNodeId) {
      if (!visibleSchemas.has(schema)) {
        continue;
      }

      const metadataTable = metadataByTableId.get(id);

      if (
        hideTablesWithoutPermissions &&
        !tableHasAnyPermission(metadataTable, role)
      ) {
        continue;
      }

      const fkColumns = foreignKeyColumnsByTable.get(id) ?? new Set<string>();
      const tableColumns = columnsByTable.get(id) ?? [];

      const computedFields: TableNodeComputedField[] =
        namingMode === 'postgres'
          ? []
          : (metadataTable?.computed_fields ?? []).map((cf) => {
              const fnId = `${cf.definition.function.schema}.${cf.definition.function.name}`;
              return {
                name: cf.name,
                returnType: returnTypeByFunctionId.get(fnId),
                functionSchema: cf.definition.function.schema,
                functionName: cf.definition.function.name,
              };
            });

      const data: TableNodeData = {
        schema,
        table,
        tableGraphqlName: readTableGraphqlName(metadataTable),
        columns: tableColumns.map((c) => ({
          name: c.columnName,
          graphqlName: readColumnGraphqlName(metadataTable, c.columnName),
          dataType: c.udtName || c.dataType,
          isNullable: c.isNullable,
          isPrimary: c.isPrimary,
          isForeignKey: fkColumns.has(c.columnName),
          isGenerated: c.isGenerated,
        })),
        computedFields,
        metadataTable,
        role,
        namingMode,
      };

      nodes.push({
        id,
        type: 'tableNode',
        position: { x: 0, y: 0 },
        width: TABLE_NODE_WIDTH,
        height: computeNodeHeight(
          data.columns.length + data.computedFields.length,
        ),
        data,
      });
      visibleNodeIds.add(id);
    }

    const edges: Edge[] =
      namingMode === 'graphql'
        ? buildGraphqlEdges(
            foreignKeys,
            metadataTables,
            metadataByTableId,
            visibleNodeIds,
          )
        : buildPostgresEdges(foreignKeys, metadataByTableId, visibleNodeIds);

    const rowCountByNodeId = new Map<string, number>();
    for (const node of nodes) {
      rowCountByNodeId.set(
        node.id,
        node.data.columns.length + node.data.computedFields.length,
      );
    }

    const positionedNodes = layoutNodes(nodes, edges, rowCountByNodeId);

    return {
      nodes: positionedNodes,
      edges,
      totalTableCount,
    };
  }, [
    metadataTables,
    columns,
    foreignKeys,
    functionReturnTypes,
    role,
    visibleSchemas,
    hideTablesWithoutPermissions,
    namingMode,
  ]);
}
