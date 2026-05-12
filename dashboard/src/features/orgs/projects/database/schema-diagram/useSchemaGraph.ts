import type { Edge, Node } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import { useMemo } from 'react';
import type { HasuraMetadataTable } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { computeNodeHeight, layoutNodes, TABLE_NODE_WIDTH } from './layout';
import { tableHasAnyPermission } from './permissionState';
import type {
  SchemaDiagramColumn,
  SchemaDiagramForeignKey,
} from './useAllTableColumns';

export interface TableNodeColumn {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimary: boolean;
  isForeignKey: boolean;
}

export interface TableNodeData extends Record<string, unknown> {
  schema: string;
  table: string;
  columns: TableNodeColumn[];
  metadataTable: HasuraMetadataTable | undefined;
  role: string;
}

export type TableNode = Node<TableNodeData, 'tableNode'>;

export interface UseSchemaGraphInput {
  metadataTables: HasuraMetadataTable[];
  columns: SchemaDiagramColumn[];
  foreignKeys: SchemaDiagramForeignKey[];
  role: string;
  visibleSchemas: Set<string>;
  hideTablesWithoutPermissions: boolean;
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

export default function useSchemaGraph({
  metadataTables,
  columns,
  foreignKeys,
  role,
  visibleSchemas,
  hideTablesWithoutPermissions,
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

      const data: TableNodeData = {
        schema,
        table,
        columns: tableColumns.map((c) => ({
          name: c.columnName,
          dataType: c.udtName || c.dataType,
          isNullable: c.isNullable,
          isPrimary: c.isPrimary,
          isForeignKey: fkColumns.has(c.columnName),
        })),
        metadataTable,
        role,
      };

      nodes.push({
        id,
        type: 'tableNode',
        position: { x: 0, y: 0 },
        width: TABLE_NODE_WIDTH,
        height: computeNodeHeight(data.columns.length),
        data,
      });
      visibleNodeIds.add(id);
    }

    const edges: Edge[] = foreignKeys
      .filter((fk) => {
        const fromId = nodeIdFor(fk.fromSchema, fk.fromTable);
        const toId = nodeIdFor(fk.toSchema, fk.toTable);
        return visibleNodeIds.has(fromId) && visibleNodeIds.has(toId);
      })
      .map((fk) => ({
        id: `${fk.constraintName}-${fk.fromSchema}.${fk.fromTable}.${fk.fromColumn}`,
        source: nodeIdFor(fk.fromSchema, fk.fromTable),
        target: nodeIdFor(fk.toSchema, fk.toTable),
        sourceHandle: columnHandleId('source', fk.fromColumn),
        targetHandle: columnHandleId('target', fk.toColumn),
        type: 'smart',
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 16,
          height: 16,
        },
      }));

    const columnCountByNodeId = new Map<string, number>();
    for (const node of nodes) {
      columnCountByNodeId.set(node.id, node.data.columns.length);
    }

    const positionedNodes = layoutNodes(nodes, edges, columnCountByNodeId);

    return {
      nodes: positionedNodes,
      edges,
      totalTableCount,
    };
  }, [
    metadataTables,
    columns,
    foreignKeys,
    role,
    visibleSchemas,
    hideTablesWithoutPermissions,
  ]);
}
