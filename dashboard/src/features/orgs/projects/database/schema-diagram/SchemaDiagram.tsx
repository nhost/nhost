import '@xyflow/react/dist/style.css';

import {
  Background,
  Controls,
  type Edge,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { Spinner } from '@/components/ui/v3/spinner';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { useExportMetadata } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useDataBrowserActions } from '@/features/orgs/projects/database/dataGrid/hooks/useDataBrowserActions';
import { useDatabaseQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery';
import { useGetTrackedTablesSet } from '@/features/orgs/projects/database/dataGrid/hooks/useGetTrackedTablesSet';
import type {
  DatabaseObjectViewModel,
  HasuraMetadataTable,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { sortDatabaseObjects } from '@/features/orgs/projects/database/dataGrid/utils/sortDatabaseObjects';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { cn } from '@/lib/utils';
import {
  useGetHasuraSettingsQuery,
  useGetRemoteAppRolesQuery,
} from '@/utils/__generated__/graphql';
import FunctionNode from './FunctionNode';
import { ADMIN_ROLE, PUBLIC_ROLE } from './permissionState';
import SchemaDiagramToolbar, {
  type SchemaDiagramSearchObject,
} from './SchemaDiagramToolbar';
import { getSchemaColor } from './schemaColor';
import { TableActionsProvider } from './TableActionsContext';
import TableEdge from './TableEdge';
import TableNode from './TableNode';
import useAllTableColumns from './useAllTableColumns';
import useSchemaGraph, {
  EDGE_MARKER_IDS,
  functionNodeIdFor,
  type NamingMode,
  nodeIdFor,
} from './useSchemaGraph';

const nodeTypes = { tableNode: TableNode, functionNode: FunctionNode } as const;
const edgeTypes = { smart: TableEdge } as const;

const EDGE_COLOR_DEFAULT = 'hsl(var(--muted-foreground))';
const EDGE_COLOR_HIGHLIGHT = 'hsl(var(--primary))';

const EDGE_MARKER_HIGHLIGHT_SUFFIX = '-highlight';

function highlightMarkerId(baseId: string) {
  return `${baseId}${EDGE_MARKER_HIGHLIGHT_SUFFIX}`;
}

// Safari does not resolve the `context-stroke` paint keyword, so markers that
// relied on it fell back to their SVG initial paint (black fill / no stroke).
// Bake the two edge colors into their own markers instead — gray for default
// edges, primary for highlighted ones — so arrowheads match the edge in every
// browser. Highlighted edges reference the `-highlight` variant via
// `highlightMarkerId`.
const MARKER_VARIANTS = [
  { idSuffix: '', color: EDGE_COLOR_DEFAULT },
  { idSuffix: EDGE_MARKER_HIGHLIGHT_SUFFIX, color: EDGE_COLOR_HIGHLIGHT },
] as const;

function EdgeMarkers({ idSuffix, color }: { idSuffix: string; color: string }) {
  return (
    <>
      <marker
        id={`${EDGE_MARKER_IDS.arrowFilled}${idSuffix}`}
        viewBox="0 0 12 12"
        refX="10"
        refY="6"
        markerWidth="8"
        markerHeight="8"
        orient="auto-start-reverse"
        markerUnits="userSpaceOnUse"
      >
        <path d="M0,0 L12,6 L0,12 z" fill={color} stroke={color} />
      </marker>
      <marker
        id={`${EDGE_MARKER_IDS.arrowHollow}${idSuffix}`}
        viewBox="0 0 12 12"
        refX="10"
        refY="6"
        markerWidth="9"
        markerHeight="9"
        orient="auto-start-reverse"
        markerUnits="userSpaceOnUse"
      >
        <path
          d="M1,1 L11,6 L1,11 z"
          className="fill-background"
          stroke={color}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </marker>
      <marker
        id={`${EDGE_MARKER_IDS.circleHollow}${idSuffix}`}
        viewBox="0 0 12 12"
        refX="2"
        refY="6"
        markerWidth="9"
        markerHeight="9"
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <circle
          cx="6"
          cy="6"
          r="4"
          className="fill-background"
          stroke={color}
          strokeWidth={1.5}
        />
      </marker>
      <marker
        id={`${EDGE_MARKER_IDS.functionArrow}${idSuffix}`}
        viewBox="0 0 14 12"
        refX="11"
        refY="6"
        markerWidth="12"
        markerHeight="10"
        orient="auto-start-reverse"
        markerUnits="userSpaceOnUse"
      >
        <path
          d="M1,1 L6,6 L1,11 M6,1 L11,6 L6,11"
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </marker>
    </>
  );
}

function EdgeMarkerDefs() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute h-0 w-0">
      <defs>
        {MARKER_VARIANTS.map((variant) => (
          <EdgeMarkers
            key={variant.idSuffix || 'default'}
            idSuffix={variant.idSuffix}
            color={variant.color}
          />
        ))}
      </defs>
    </svg>
  );
}

function SchemaDiagramContent() {
  const { fitView } = useReactFlow();
  const {
    query: { dataSourceSlug },
  } = useRouter();
  const dataSource = (dataSourceSlug as string | undefined) ?? 'default';

  const {
    data: metadataTables,
    isLoading: metadataLoading,
    error: metadataError,
  } = useExportMetadata((data) => {
    const source = data.metadata.sources?.find((s) => s.name === dataSource);
    return (source?.tables ?? []) as unknown as HasuraMetadataTable[];
  });

  const { data: functionsMetadata } = useExportMetadata((data) => {
    const source = data.metadata.sources?.find((s) => s.name === dataSource);
    return source?.functions ?? [];
  });

  const {
    data: schemaData,
    isLoading: columnsLoading,
    error: columnsError,
  } = useAllTableColumns(dataSource);

  const gqlClient = useRemoteApplicationGQLClient();
  const {
    data: rolesData,
    loading: rolesLoading,
    error: rolesError,
  } = useGetRemoteAppRolesQuery({ client: gqlClient });

  // Same source as the Edit Function Permissions form, so the diagram's function
  // permission dots and the form never disagree. Not added to the loading gate:
  // the role defaults to admin (always allowed), so this only affects non-admin
  // dots, by which time the small/cached settings query has resolved.
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const { data: hasuraSettingsData } = useGetHasuraSettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
    skip: !project?.id,
  });

  const inferFunctionPermissions = Boolean(
    hasuraSettingsData?.config?.hasura.settings?.inferFunctionPermissions,
  );

  const { data: trackedTablesSet } = useGetTrackedTablesSet({
    dataSource,
  });

  const { data: databaseData, refetch: refetchDatabaseQuery } =
    useDatabaseQuery([dataSource], { dataSource });

  const allObjects = useMemo<DatabaseObjectViewModel[]>(() => {
    const tableLikeObjects = databaseData?.tableLikeObjects ?? [];
    return sortDatabaseObjects(
      tableLikeObjects.map((tableLikeObject) => ({
        schema: tableLikeObject.table_schema,
        name: tableLikeObject.table_name,
        objectType: tableLikeObject.table_type || 'ORDINARY TABLE',
        updatability: tableLikeObject.updatability,
      })),
    );
  }, [databaseData?.tableLikeObjects]);

  const availableSchemas = useMemo(() => {
    const set = new Set<string>();
    for (const col of schemaData?.columns ?? []) {
      set.add(col.schema);
    }
    for (const t of metadataTables ?? []) {
      if (t.table.schema) {
        set.add(t.table.schema);
      }
    }
    for (const fn of schemaData?.functionReturnTypes ?? []) {
      if (fn.returnsSet && fn.returnTable) {
        set.add(fn.schema);
      }
    }
    return Array.from(set).sort();
  }, [schemaData?.columns, schemaData?.functionReturnTypes, metadataTables]);

  const targetSchema = useMemo(() => {
    if (availableSchemas.includes('public')) {
      return 'public';
    }
    return availableSchemas[0] ?? '';
  }, [availableSchemas]);

  const [selectedRole, setSelectedRole] = useState<string>(ADMIN_ROLE);
  const [deselectedSchemas, setDeselectedSchemas] = useState<Set<string>>(
    () => new Set(),
  );
  const [hideEmpty, setHideEmpty] = useState(false);
  const [namingMode, setNamingMode] = useState<NamingMode>('postgres');
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [pendingFocusNodeId, setPendingFocusNodeId] = useState<string | null>(
    null,
  );

  const focusNode = useCallback((id: string, schemasToReveal: string[]) => {
    setSelectedEdgeId(null);
    setDeselectedSchemas((prev) => {
      if (schemasToReveal.every((schema) => !prev.has(schema))) {
        return prev;
      }
      const next = new Set(prev);
      for (const schema of schemasToReveal) {
        next.delete(schema);
      }
      return next;
    });
    setSelectedNodeIds(new Set([id]));
    setPendingFocusNodeId(id);
  }, []);

  const focusTable = useCallback(
    (schema: string, name: string) => {
      focusNode(nodeIdFor(schema, name), [schema]);
    },
    [focusNode],
  );

  const handleSelectObject = useCallback(
    (object: SchemaDiagramSearchObject) => {
      if (object.kind === 'function') {
        const schemasToReveal = object.returnSchema
          ? [object.schema, object.returnSchema]
          : [object.schema];
        focusNode(
          functionNodeIdFor(object.schema, object.name),
          schemasToReveal,
        );
        return;
      }
      focusNode(nodeIdFor(object.schema, object.name), [object.schema]);
    },
    [focusNode],
  );

  const handleTableCreated = useCallback(
    (info: { schema: string; name: string }) =>
      focusTable(info.schema, info.name),
    [focusTable],
  );

  const dataBrowserActions = useDataBrowserActions({
    dataSourceSlug: dataSource,
    selectedSchema: targetSchema,
    refetchDatabaseQuery,
    allObjects,
    availableSchemas,
    onTableCreated: handleTableCreated,
  });

  const selectedSchemas = useMemo(
    () => availableSchemas.filter((s) => !deselectedSchemas.has(s)),
    [availableSchemas, deselectedSchemas],
  );

  const visibleSchemas = useMemo(
    () => new Set(selectedSchemas),
    [selectedSchemas],
  );

  const handleSelectedSchemasChange = (next: string[]) => {
    const nextSelected = new Set(next);
    setDeselectedSchemas(
      new Set(availableSchemas.filter((s) => !nextSelected.has(s))),
    );
  };

  const { nodes, edges, totalTableCount } = useSchemaGraph({
    metadataTables: metadataTables ?? [],
    tableLikeObjects: databaseData?.tableLikeObjects ?? [],
    columns: schemaData?.columns ?? [],
    foreignKeys: schemaData?.foreignKeys ?? [],
    functionReturnTypes: schemaData?.functionReturnTypes ?? [],
    functionsMetadata: functionsMetadata ?? [],
    inferFunctionPermissions,
    role: selectedRole,
    visibleSchemas,
    hideTablesWithoutPermissions: hideEmpty,
    namingMode,
  });

  const focusedNodeIds = useMemo(() => {
    if (selectedNodeIds.size === 0 && !selectedEdgeId) {
      return null;
    }
    const ids = new Set<string>(selectedNodeIds);
    if (selectedEdgeId) {
      const edge = edges.find((e) => e.id === selectedEdgeId);
      if (edge) {
        ids.add(edge.source);
        ids.add(edge.target);
      }
    }
    if (selectedNodeIds.size === 1) {
      const [only] = selectedNodeIds;
      for (const edge of edges) {
        if (edge.source === only) {
          ids.add(edge.target);
        }
        if (edge.target === only) {
          ids.add(edge.source);
        }
      }
    }
    return ids;
  }, [edges, selectedNodeIds, selectedEdgeId]);

  const styledEdges = useMemo<Edge[]>(() => {
    const multiSelect = selectedNodeIds.size >= 2;
    return edges.map((edge) => {
      let isHighlighted = false;
      if (selectedEdgeId) {
        isHighlighted = edge.id === selectedEdgeId;
      } else if (multiSelect) {
        isHighlighted =
          selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target);
      } else if (selectedNodeIds.size === 1) {
        const [only] = selectedNodeIds;
        isHighlighted = edge.source === only || edge.target === only;
      }
      const isDimmed = !!focusedNodeIds && !isHighlighted;
      const color = isHighlighted ? EDGE_COLOR_HIGHLIGHT : EDGE_COLOR_DEFAULT;
      return {
        ...edge,
        animated: isHighlighted,
        zIndex: isHighlighted ? 1000 : 0,
        markerStart:
          isHighlighted && typeof edge.markerStart === 'string'
            ? highlightMarkerId(edge.markerStart)
            : edge.markerStart,
        markerEnd:
          isHighlighted && typeof edge.markerEnd === 'string'
            ? highlightMarkerId(edge.markerEnd)
            : edge.markerEnd,
        style: {
          ...edge.style,
          stroke: color,
          strokeWidth: isHighlighted ? 2 : 1.25,
          opacity: isDimmed ? (multiSelect ? 0.05 : 0.15) : 1,
          transition: 'opacity 150ms, stroke 150ms, stroke-width 150ms',
        },
      };
    });
  }, [edges, focusedNodeIds, selectedEdgeId, selectedNodeIds]);

  const styledNodes = useMemo(() => {
    return nodes.map((node) => {
      const isSelected = selectedNodeIds.has(node.id);
      const isDimmed = !!focusedNodeIds && !focusedNodeIds.has(node.id);
      const isUntracked =
        node.type === 'functionNode'
          ? node.data.isUntracked
          : !node.data.metadataTable;
      const schemaColor = getSchemaColor(node.data.schema);
      const baseOpacity = isSelected ? 1 : isDimmed || isUntracked ? 0.35 : 1;
      return {
        ...node,
        className: cn(
          node.className,
          'rounded-md transition-[opacity,box-shadow] duration-150',
          isSelected &&
            'shadow-[0_8px_24px_rgb(var(--schema-color)/0.35)] ring-2 ring-[rgb(var(--schema-color))]',
        ),
        style: {
          ...node.style,
          '--schema-color': schemaColor,
          opacity: baseOpacity,
        },
        zIndex: isSelected ? 1001 : node.zIndex,
      };
    });
  }, [nodes, focusedNodeIds, selectedNodeIds]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: { id: string }) => {
      setSelectedEdgeId(null);
      setSelectedNodeIds((current) => {
        const next = new Set(current);
        if (next.has(node.id)) {
          next.delete(node.id);
        } else {
          next.add(node.id);
        }
        return next;
      });
    },
    [],
  );
  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: { id: string }) => {
      setSelectedNodeIds(new Set());
      setSelectedEdgeId((current) => (current === edge.id ? null : edge.id));
    },
    [],
  );
  const handlePaneClick = useCallback(() => {
    setSelectedNodeIds(new Set());
    setSelectedEdgeId(null);
  }, []);

  useEffect(() => {
    if (!pendingFocusNodeId) {
      return;
    }
    if (!nodes.some((n) => n.id === pendingFocusNodeId)) {
      return;
    }
    const targetId = pendingFocusNodeId;
    setPendingFocusNodeId(null);
    requestAnimationFrame(() => {
      fitView({
        nodes: [{ id: targetId }],
        duration: 600,
        maxZoom: 0.85,
        padding: 0.8,
      });
    });
  }, [nodes, fitView, pendingFocusNodeId]);

  const roles = useMemo(() => {
    const names = (rolesData?.authRoles ?? []).map((r) => r.role);
    return [
      ADMIN_ROLE,
      PUBLIC_ROLE,
      ...names.filter((r) => r !== ADMIN_ROLE && r !== PUBLIC_ROLE),
    ];
  }, [rolesData]);

  const searchableObjects = useMemo<SchemaDiagramSearchObject[]>(() => {
    const byId = new Map<string, SchemaDiagramSearchObject>();
    for (const c of schemaData?.columns ?? []) {
      byId.set(`table:${c.schema}.${c.table}`, {
        kind: 'table',
        schema: c.schema,
        name: c.table,
      });
    }
    for (const t of metadataTables ?? []) {
      byId.set(`table:${t.table.schema}.${t.table.name}`, {
        kind: 'table',
        schema: t.table.schema,
        name: t.table.name,
      });
    }
    for (const fn of schemaData?.functionReturnTypes ?? []) {
      if (fn.returnsSet && fn.returnTable && fn.returnSchema) {
        byId.set(`function:${fn.schema}.${fn.name}`, {
          kind: 'function',
          schema: fn.schema,
          name: fn.name,
          returnSchema: fn.returnSchema,
        });
      }
    }
    return [...byId.values()].sort((a, b) =>
      a.schema === b.schema
        ? a.name.localeCompare(b.name)
        : a.schema.localeCompare(b.schema),
    );
  }, [schemaData?.columns, schemaData?.functionReturnTypes, metadataTables]);

  if (metadataLoading || columnsLoading || rolesLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (metadataError || columnsError || rolesError) {
    const error = metadataError ?? columnsError ?? rolesError;
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertDescription>
            {error instanceof Error
              ? error.message
              : 'Failed to load schema diagram.'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <TableActionsProvider
      value={{ actions: dataBrowserActions, trackedTablesSet }}
    >
      <div className="flex h-full flex-col">
        <SchemaDiagramToolbar
          roles={roles}
          selectedRole={selectedRole}
          onRoleChange={setSelectedRole}
          schemas={availableSchemas}
          selectedSchemas={selectedSchemas}
          onSelectedSchemasChange={handleSelectedSchemasChange}
          hideEmpty={hideEmpty}
          onHideEmptyChange={setHideEmpty}
          namingMode={namingMode}
          onNamingModeChange={setNamingMode}
          onNewTable={dataBrowserActions.openCreateTableDrawer}
          canCreateTable={!!targetSchema}
          targetSchema={targetSchema}
          objects={searchableObjects}
          onSelectObject={handleSelectObject}
        />

        <div className="relative min-h-0 flex-1">
          <EdgeMarkerDefs />
          {totalTableCount === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
              No tables found.
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
              <span>No tables match the current filters.</span>
            </div>
          ) : (
            <ReactFlow
              nodes={styledNodes}
              edges={styledEdges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              fitViewOptions={{ padding: 0.1, maxZoom: 1.25 }}
              minZoom={0.1}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable
              multiSelectionKeyCode={null}
              panOnDrag
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
              onPaneClick={handlePaneClick}
              className="schema-diagram-canvas"
            >
              <Background />
              <MiniMap
                pannable
                zoomable
                className="!border !border-border"
                bgColor="hsl(var(--card))"
                maskColor="hsl(var(--background) / 0.75)"
                maskStrokeColor="hsl(var(--border))"
                maskStrokeWidth={2}
                nodeColor="hsl(var(--muted-foreground))"
                nodeStrokeColor="hsl(var(--border))"
                nodeStrokeWidth={3}
                nodeBorderRadius={4}
              />
              <Controls
                showInteractive={false}
                className="!shadow-none [&>button]:!border-border [&>button]:!bg-muted [&>button]:!fill-foreground [&>button:hover]:!bg-accent [&>button>svg]:!fill-foreground overflow-hidden rounded-md border border-border"
              />
            </ReactFlow>
          )}
        </div>
      </div>
    </TableActionsProvider>
  );
}

export default function SchemaDiagram() {
  return (
    <ReactFlowProvider>
      <SchemaDiagramContent />
    </ReactFlowProvider>
  );
}
