import { Handle, type NodeProps, Position } from '@xyflow/react';
import { Settings } from 'lucide-react';
import { memo, type ReactNode } from 'react';
import { findPermission } from '@/components/common/PermissionsGrid';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import DatabaseObjectActions from '@/features/orgs/projects/database/dataGrid/components/DataBrowserSidebar/DatabaseObjectActions';
import type {
  DatabaseAction,
  HasuraMetadataTable,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { isSchemaLocked } from '@/features/orgs/projects/database/dataGrid/utils/schemaHelpers';
import { cn } from '@/lib/utils';
import PermissionDot from './PermissionDot';
import {
  ADMIN_ROLE,
  DATABASE_ACTIONS,
  getColumnPermissionState,
  getRelevantRules,
  getTablePermissionState,
  type PermissionDotState,
  type RuleKey,
} from './permissionState';
import { useTableActionsContext } from './TableActionsContext';
import { columnHandleId, type TableNode } from './useSchemaGraph';

const COLUMN_ACTIONS: readonly DatabaseAction[] = [
  'select',
  'insert',
  'update',
] as const;

const ACTION_LABELS: Record<DatabaseAction, string> = {
  select: 'Select',
  insert: 'Insert',
  update: 'Update',
  delete: 'Delete',
};

const RULE_LABELS: Record<RuleKey, string> = {
  filter: 'Row filter',
  check: 'Row check',
};

function describeState(state: PermissionDotState): string {
  switch (state) {
    case 'filled':
      return 'allowed';
    case 'hollow':
      return 'allowed with row rule';
    default:
      return 'not allowed';
  }
}

function TableDotTooltipContent({
  action,
  state,
  metadataTable,
  role,
}: {
  action: DatabaseAction;
  state: PermissionDotState;
  metadataTable: HasuraMetadataTable | undefined;
  role: string;
}): ReactNode {
  const label = `${ACTION_LABELS[action]} — ${describeState(state)}`;

  if (role === ADMIN_ROLE) {
    return (
      <div className="space-y-1">
        <div className="font-semibold">{label}</div>
        <div className="text-muted-foreground text-xs">
          Admin role — full access.
        </div>
      </div>
    );
  }

  if (state === 'none') {
    return (
      <div className="space-y-1">
        <div className="font-semibold">{label}</div>
        <div className="text-muted-foreground text-xs">
          Role <span className="font-mono">{role}</span> has no {action}{' '}
          permission on this table.
        </div>
      </div>
    );
  }

  const permission = findPermission(metadataTable, role, action);
  const rules = getRelevantRules(permission, action);

  return (
    <div className="space-y-1">
      <div className="font-semibold">{label}</div>
      {rules.length === 0 ? (
        <div className="text-muted-foreground text-xs">
          No row rule — applies to all rows.
        </div>
      ) : (
        rules.map(({ key, value }) => (
          <div key={key} className="space-y-1">
            <div className="text-muted-foreground text-xs">
              {RULE_LABELS[key]}:
            </div>
            <pre className="max-w-[360px] overflow-x-auto rounded bg-muted p-2 font-mono text-[11px] leading-tight">
              {JSON.stringify(value, null, 2)}
            </pre>
          </div>
        ))
      )}
    </div>
  );
}

function TableNodeView({ data }: NodeProps<TableNode>) {
  const { schema, table, columns, metadataTable, role } = data;
  const tableActions = useTableActionsContext();
  const objectKey = `ORDINARY TABLE.${schema}.${table}`;
  const tablePath = `${schema}.${table}`;
  const isUntracked = !tableActions?.trackedTablesSet?.has(tablePath);
  const isLocked = isSchemaLocked(schema);
  const isMenuOpen = tableActions?.actions.sidebarMenuObject === objectKey;
  const isRemoving = tableActions?.actions.removableObject === objectKey;

  return (
    <div
      className={cn(
        'w-[280px] overflow-hidden rounded-md border border-y-border border-r-border border-l-4 border-l-[rgb(var(--schema-color))] bg-background text-foreground shadow-md',
      )}
      title={isUntracked ? 'Untracked in GraphQL' : undefined}
    >
      <div className="flex items-center justify-between gap-2 border-border border-b bg-muted/60 px-3 py-2">
        <div className="min-w-0">
          <div
            className="truncate text-[rgb(var(--schema-color))] text-xs"
            title={schema}
          >
            {schema}
          </div>
          <div className="truncate font-semibold text-sm" title={table}>
            {table}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {DATABASE_ACTIONS.map((action) => {
            const state = getTablePermissionState(metadataTable, role, action);
            return (
              <Tooltip key={action} delayDuration={150}>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-help">
                    <PermissionDot action={action} size={11} state={state} />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[400px] text-xs">
                  <TableDotTooltipContent
                    action={action}
                    state={state}
                    metadataTable={metadataTable}
                    role={role}
                  />
                </TooltipContent>
              </Tooltip>
            );
          })}
          {tableActions && (
            <span
              className="nodrag nopan inline-flex"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              role="none"
            >
              <DatabaseObjectActions
                objectName={table}
                objectType="ORDINARY TABLE"
                isUntracked={isUntracked}
                disabled={isRemoving}
                open={isMenuOpen}
                triggerIcon={<Settings className="h-3.5 w-3.5" />}
                onOpen={() =>
                  tableActions.actions.setSidebarMenuObject(objectKey)
                }
                onClose={() =>
                  tableActions.actions.setSidebarMenuObject(undefined)
                }
                className="ml-1"
                isSelectedNotSchemaLocked={!isLocked}
                onEdit={() =>
                  tableActions.actions.openEditTableDrawer(schema, table)
                }
                onEditPermissions={
                  isUntracked
                    ? undefined
                    : () =>
                        tableActions.actions.handleEditPermission(
                          schema,
                          table,
                          'ORDINARY TABLE',
                        )
                }
                onEditRelationships={
                  isUntracked
                    ? undefined
                    : () =>
                        tableActions.actions.handleEditRelationships(
                          schema,
                          table,
                        )
                }
                onEditGraphQLSettings={() =>
                  tableActions.actions.handleEditGraphQLSettings(
                    schema,
                    table,
                    'ORDINARY TABLE',
                  )
                }
                onDelete={() =>
                  tableActions.actions.handleDeleteDatabaseObject(
                    schema,
                    table,
                    'ORDINARY TABLE',
                  )
                }
              />
            </span>
          )}
        </div>
      </div>

      {columns.length === 0 ? (
        <div className="px-3 py-2 text-muted-foreground text-xs italic">
          No columns
        </div>
      ) : (
        <ul className="py-1">
          {columns.map((column) => (
            <li
              key={column.name}
              className="relative flex items-center justify-between gap-2 px-3 py-1 text-xs hover:bg-accent/40"
            >
              <Handle
                type="target"
                position={Position.Left}
                id={columnHandleId('target', column.name)}
                className="!h-2 !w-2 !border-border !bg-muted-foreground"
                style={{ left: -4 }}
              />
              <Handle
                type="source"
                position={Position.Right}
                id={columnHandleId('source', column.name)}
                className="!h-2 !w-2 !border-border !bg-muted-foreground"
                style={{ right: -4 }}
              />

              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className={cn(
                    'truncate font-mono',
                    column.isPrimary && 'font-semibold text-primary',
                  )}
                  title={column.name}
                >
                  {column.name}
                </span>
                {column.isPrimary && (
                  <span className="rounded bg-primary/15 px-1 py-px font-medium text-[10px] text-primary uppercase">
                    PK
                  </span>
                )}
                {column.isForeignKey && (
                  <span className="rounded bg-muted px-1 py-px font-medium text-[10px] text-muted-foreground uppercase">
                    FK
                  </span>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <span
                  className="truncate font-mono text-[10px] text-muted-foreground"
                  title={column.dataType}
                >
                  {column.dataType}
                </span>
                <div className="flex items-center gap-1">
                  {COLUMN_ACTIONS.map((action) => (
                    <PermissionDot
                      key={action}
                      action={action}
                      size={8}
                      state={getColumnPermissionState(
                        metadataTable,
                        role,
                        action,
                        column.name,
                      )}
                    />
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default memo(TableNodeView);
