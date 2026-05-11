import '@xyflow/react/dist/style.css';

import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import { useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { Spinner } from '@/components/ui/v3/spinner';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { useExportMetadata } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import type { HasuraMetadataTable } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { useGetRemoteAppRolesQuery } from '@/utils/__generated__/graphql';
import { ADMIN_ROLE } from './permissionState';
import SchemaDiagramToolbar from './SchemaDiagramToolbar';
import TableNode from './TableNode';
import useAllTableColumns from './useAllTableColumns';
import useSchemaGraph from './useSchemaGraph';

const DATA_SOURCE = 'default';

const nodeTypes = { tableNode: TableNode } as const;

function SchemaDiagramContent() {
  const {
    data: metadataTables,
    isLoading: metadataLoading,
    error: metadataError,
  } = useExportMetadata((data) => {
    const source = data.metadata.sources?.find((s) => s.name === DATA_SOURCE);
    return (source?.tables ?? []) as unknown as HasuraMetadataTable[];
  });

  const {
    data: schemaData,
    isLoading: columnsLoading,
    error: columnsError,
  } = useAllTableColumns(DATA_SOURCE);

  const gqlClient = useRemoteApplicationGQLClient();
  const {
    data: rolesData,
    loading: rolesLoading,
    error: rolesError,
  } = useGetRemoteAppRolesQuery({ client: gqlClient });

  const [selectedRole, setSelectedRole] = useState<string>(ADMIN_ROLE);
  const [selectedSchemas, setSelectedSchemas] = useState<string[] | null>(null);
  const [hideEmpty, setHideEmpty] = useState(false);

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
    return Array.from(set).sort();
  }, [schemaData?.columns, metadataTables]);

  useEffect(() => {
    if (selectedSchemas === null && availableSchemas.length > 0) {
      setSelectedSchemas(availableSchemas);
    }
  }, [availableSchemas, selectedSchemas]);

  const visibleSchemas = useMemo(
    () => new Set(selectedSchemas ?? availableSchemas),
    [selectedSchemas, availableSchemas],
  );

  const { nodes, edges, totalTableCount } = useSchemaGraph({
    metadataTables: metadataTables ?? [],
    columns: schemaData?.columns ?? [],
    foreignKeys: schemaData?.foreignKeys ?? [],
    role: selectedRole,
    visibleSchemas,
    hideTablesWithoutPermissions: hideEmpty,
  });

  const roles = useMemo(() => {
    const names = (rolesData?.authRoles ?? []).map((r) => r.role);
    return [ADMIN_ROLE, ...names.filter((r) => r !== ADMIN_ROLE)];
  }, [rolesData]);

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
    <div className="flex h-full flex-col">
      <SchemaDiagramToolbar
        roles={roles}
        selectedRole={selectedRole}
        onRoleChange={setSelectedRole}
        schemas={availableSchemas}
        selectedSchemas={selectedSchemas ?? availableSchemas}
        onSelectedSchemasChange={setSelectedSchemas}
        hideEmpty={hideEmpty}
        onHideEmptyChange={setHideEmpty}
      />

      <div className="relative min-h-0 flex-1">
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
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.15, maxZoom: 0.85 }}
            minZoom={0.1}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            nodesDraggable
            nodesConnectable={false}
            elementsSelectable
            className="schema-diagram-canvas"
          >
            <Background />
            <MiniMap
              pannable
              zoomable
              className="!border !border-border"
              bgColor="rgb(30, 41, 59)"
              maskColor="rgba(15, 23, 42, 0.75)"
              maskStrokeColor="rgb(148, 163, 184)"
              maskStrokeWidth={2}
              nodeColor="rgb(241, 245, 249)"
              nodeStrokeColor="rgb(148, 163, 184)"
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
  );
}

export default function SchemaDiagram() {
  return (
    <ReactFlowProvider>
      <SchemaDiagramContent />
    </ReactFlowProvider>
  );
}
