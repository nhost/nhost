import { Handle, type NodeProps, Position } from '@xyflow/react';
import { Settings, Sigma } from 'lucide-react';
import { memo, type ReactNode } from 'react';
import { findPermission } from '@/components/common/PermissionsGrid';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
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
  getComputedFieldPermissionState,
  getRelevantRules,
  getTablePermissionState,
  type PermissionDotState,
  type RuleKey,
} from './permissionState';
import { useTableActionsContext } from './TableActionsContext';
import {
  columnHandleId,
  type NamingMode,
  type TableNode,
  type TableNodeComputedField,
} from './useSchemaGraph';

const GRAPHQL_NAME_CLASS = 'text-purple-600 dark:text-purple-400';

function resolveDisplayName(
  postgresName: string,
  graphqlName: string | undefined,
  namingMode: NamingMode,
): { name: string; isCustomGraphql: boolean } {
  if (
    namingMode === 'graphql' &&
    graphqlName !== undefined &&
    graphqlName !== postgresName
  ) {
    return { name: graphqlName, isCustomGraphql: true };
  }
  return { name: postgresName, isCustomGraphql: false };
}

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

function ComputedFieldTooltipContent({
  field,
}: {
  field: TableNodeComputedField;
}): ReactNode {
  const fnRef = `${field.functionSchema}.${field.functionName}`;
  return (
    <div className="space-y-1">
      <div className="font-semibold">Computed field</div>
      <div className="text-muted-foreground text-xs">
        Calls <span className="font-mono">{fnRef}</span>
      </div>
    </div>
  );
}

function TableNodeView({ data }: NodeProps<TableNode>) {
  const {
    schema,
    table,
    tableGraphqlName,
    columns,
    computedFields,
    metadataTable,
    role,
    namingMode,
  } = data;
  const tableActions = useTableActionsContext();
  const objectKey = `ORDINARY TABLE.${schema}.${table}`;
  const tablePath = `${schema}.${table}`;
  const isUntracked = !tableActions?.trackedTablesSet?.has(tablePath);
  const isLocked = isSchemaLocked(schema);
  const isMenuOpen = tableActions?.actions.sidebarMenuObject === objectKey;
  const isRemoving = tableActions?.actions.removableObject === objectKey;

  const displayTable = resolveDisplayName(table, tableGraphqlName, namingMode);

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
          <div
            className={cn(
              'truncate font-semibold text-sm',
              displayTable.isCustomGraphql && GRAPHQL_NAME_CLASS,
            )}
            title={displayTable.name}
          >
            {displayTable.name}
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
                triggerClassName="hover:bg-accent hover:text-accent-foreground"
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

      {columns.length === 0 && computedFields.length === 0 ? (
        <div className="px-3 py-2 text-muted-foreground text-xs italic">
          No columns
        </div>
      ) : (
        <ul className="py-1">
          {columns.map((column) => {
            const displayColumn = resolveDisplayName(
              column.name,
              column.graphqlName,
              namingMode,
            );
            return (
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

                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <TextWithTooltip
                    text={displayColumn.name}
                    containerClassName="min-w-0 flex-1"
                    className={cn(
                      'font-mono',
                      column.isPrimary && 'font-semibold text-primary',
                      displayColumn.isCustomGraphql &&
                        !column.isPrimary &&
                        GRAPHQL_NAME_CLASS,
                    )}
                  />
                  {column.isPrimary && (
                    <span className="shrink-0 rounded bg-primary/15 px-1 py-px font-medium text-primary text-xs- uppercase">
                      PK
                    </span>
                  )}
                  {column.isForeignKey && (
                    <span className="shrink-0 rounded bg-muted px-1 py-px font-medium text-muted-foreground text-xs- uppercase">
                      FK
                    </span>
                  )}
                  {column.isGenerated && (
                    <Tooltip delayDuration={150}>
                      <TooltipTrigger asChild>
                        <span className="inline-flex shrink-0 cursor-help">
                          <Sigma
                            aria-label="Generated column"
                            className="h-3 w-3 text-muted-foreground"
                          />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <span className="font-semibold">Generated column</span>{' '}
                        — value is computed by Postgres.
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <TextWithTooltip
                    text={column.dataType}
                    containerClassName="max-w-[80px]"
                    className="font-mono text-muted-foreground text-xs-"
                  />
                  <div className="flex items-center gap-1">
                    {COLUMN_ACTIONS.map((action) => (
                      <PermissionDot
                        key={action}
                        action={action}
                        size={8}
                        state={
                          column.isGenerated && action !== 'select'
                            ? 'none'
                            : getColumnPermissionState(
                                metadataTable,
                                role,
                                action,
                                column.name,
                              )
                        }
                      />
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
          {namingMode === 'graphql' &&
            computedFields.map((field) => (
              <li
                key={field.name}
                className="relative flex items-center justify-between gap-2 px-3 py-1 text-xs hover:bg-accent/40"
              >
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <TextWithTooltip
                    text={field.name}
                    containerClassName="min-w-0 flex-1"
                    className="font-mono text-purple-600 italic dark:text-purple-400"
                  />
                  <Tooltip delayDuration={150}>
                    <TooltipTrigger asChild>
                      <span className="inline-flex shrink-0 cursor-help">
                        <Sigma
                          aria-label="Computed field"
                          className="h-3 w-3 text-purple-600 dark:text-purple-400"
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-[400px] text-xs"
                    >
                      <ComputedFieldTooltipContent field={field} />
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {field.returnType && (
                    <TextWithTooltip
                      text={field.returnType}
                      containerClassName="max-w-[80px]"
                      className="font-mono text-muted-foreground text-xs-"
                    />
                  )}
                  <div className="flex items-center gap-1">
                    {COLUMN_ACTIONS.map((action) => (
                      <PermissionDot
                        key={action}
                        action={action}
                        size={8}
                        state={
                          action === 'select'
                            ? getComputedFieldPermissionState(
                                metadataTable,
                                role,
                                field.name,
                              )
                            : 'none'
                        }
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
