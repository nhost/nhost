import { Handle, type NodeProps, Position } from '@xyflow/react';
import { Settings, SquareFunction } from 'lucide-react';
import { memo } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import DatabaseObjectActions from '@/features/orgs/projects/database/dataGrid/components/DataBrowserSidebar/DatabaseObjectActions';
import { isSchemaLocked } from '@/features/orgs/projects/database/dataGrid/utils/schemaHelpers';
import { cn } from '@/lib/utils';
import { GRAPHQL_NAME_CLASS, resolveDisplayName } from './displayName';
import PermissionDot from './PermissionDot';
import {
  ADMIN_ROLE,
  getTablePermissionState,
  type PermissionDotState,
} from './permissionState';
import { useTableActionsContext } from './TableActionsContext';
import { FUNCTION_SOURCE_HANDLE_ID, type FunctionNode } from './useSchemaGraph';

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

function FunctionNodeView({ data }: NodeProps<FunctionNode>) {
  const {
    schema,
    name,
    oid,
    graphqlName,
    returnTablePostgres,
    returnTableGraphql,
    returnTableMetadata,
    isUntracked,
    role,
    namingMode,
  } = data;
  const tableActions = useTableActionsContext();
  const objectKey = `FUNCTION.${schema}.${name}`;
  const isLocked = isSchemaLocked(schema);
  const isMenuOpen = tableActions?.actions.sidebarMenuObject === objectKey;
  const isRemoving = tableActions?.actions.removableObject === objectKey;

  const display = resolveDisplayName(name, graphqlName, namingMode);
  const returnTableName =
    namingMode === 'graphql' && returnTableGraphql
      ? returnTableGraphql
      : returnTablePostgres;
  const selectState = getTablePermissionState(
    returnTableMetadata,
    role,
    'select',
  );

  return (
    <div
      className="w-[280px] overflow-hidden rounded-md border border-y-border border-r-border border-l-4 border-l-[rgb(var(--schema-color))] bg-background text-foreground shadow-md"
      title={isUntracked ? 'Untracked in GraphQL' : undefined}
    >
      {/* Edge anchor only; kept invisible so the function node has no stray
          handle dot (the dashed edge already shows the link to the table). */}
      <Handle
        type="source"
        position={Position.Right}
        id={FUNCTION_SOURCE_HANDLE_ID}
        className="!h-2 !w-2 !border-0 !bg-transparent !opacity-0"
        style={{ right: -4 }}
      />

      <div className="flex items-center justify-between gap-2 border-border border-b bg-muted/60 px-3 py-2">
        <div className="flex min-w-0 items-start gap-2">
          <SquareFunction
            aria-label="Function"
            className="h-4 w-4 shrink-0 translate-y-px text-[rgb(var(--schema-color))]"
          />
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
                isUntracked && 'italic',
                display.isCustomGraphql && GRAPHQL_NAME_CLASS,
              )}
              title={display.name}
            >
              {display.name}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-help">
                <PermissionDot action="select" size={11} state={selectState} />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[400px] text-xs">
              <div className="space-y-1">
                <div className="font-semibold">
                  Select — {describeState(selectState)}
                </div>
                <div className="text-muted-foreground">
                  Returns rows of{' '}
                  <span className="font-mono">{returnTablePostgres}</span>.
                  Access follows its select permission
                  {role !== ADMIN_ROLE ? (
                    <>
                      {' '}
                      for <span className="font-mono">{role}</span>
                    </>
                  ) : null}
                  .
                </div>
              </div>
            </TooltipContent>
          </Tooltip>

          {tableActions && (
            <span
              className="nodrag nopan inline-flex"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              role="none"
            >
              <DatabaseObjectActions
                objectName={name}
                objectType="FUNCTION"
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
                  tableActions.actions.openEditFunctionDrawer(
                    schema,
                    name,
                    oid ?? '',
                  )
                }
                onEditPermissions={
                  isUntracked
                    ? undefined
                    : () =>
                        tableActions.actions.handleEditFunctionPermission(
                          schema,
                          name,
                          oid,
                        )
                }
                onEditGraphQLSettings={() =>
                  tableActions.actions.handleEditGraphQLSettings(
                    schema,
                    name,
                    'FUNCTION',
                    oid,
                  )
                }
                onDelete={() =>
                  tableActions.actions.handleDeleteDatabaseObject(
                    schema,
                    name,
                    'FUNCTION',
                    oid,
                  )
                }
              />
            </span>
          )}
        </div>
      </div>

      <div className="px-3 py-1.5">
        <span className="font-mono text-muted-foreground text-xs">setof </span>
        <span className="font-mono text-xs">{returnTableName}</span>
      </div>
    </div>
  );
}

export default memo(FunctionNodeView);
