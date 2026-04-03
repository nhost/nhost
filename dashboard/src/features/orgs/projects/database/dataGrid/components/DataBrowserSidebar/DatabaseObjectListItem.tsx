import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import type { useDataBrowserActions } from '@/features/orgs/projects/database/dataGrid/hooks/useDataBrowserActions';
import { useGetEnumsSet } from '@/features/orgs/projects/database/dataGrid/hooks/useGetEnumsSet';
import { useGetTrackedFunctionsSet } from '@/features/orgs/projects/database/dataGrid/hooks/useGetTrackedFunctionsSet';
import { useGetTrackedTablesSet } from '@/features/orgs/projects/database/dataGrid/hooks/useGetTrackedTablesSet';
import type { DatabaseObjectViewModel } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getDatabaseObjectIcon } from '@/features/orgs/projects/database/dataGrid/utils/getDatabaseObjectIcon';
import { getObjectTypeUrlSegment } from '@/features/orgs/projects/database/dataGrid/utils/getObjectTypeUrlSegment';
import { isSchemaLocked } from '@/features/orgs/projects/database/dataGrid/utils/schemaHelpers';
import { cn } from '@/lib/utils';
import DatabaseObjectActions from './DatabaseObjectActions';

interface DatabaseObjectListItemProps {
  databaseObject: DatabaseObjectViewModel;
  dataBrowserActions: ReturnType<typeof useDataBrowserActions>;
  onSidebarItemClick?: (tablePath?: string) => void;
}

export default function DatabaseObjectListItem({
  databaseObject,
  dataBrowserActions,
  onSidebarItemClick,
}: DatabaseObjectListItemProps) {
  const {
    query: {
      orgSlug,
      appSubdomain,
      dataSourceSlug,
      schemaSlug,
      tableSlug,
      functionOID,
    },
  } = useRouter();

  const {
    removableObject,
    sidebarMenuObject,
    setSidebarMenuObject,
    handleEditPermission,
    handleDeleteDatabaseObject,
    handleEditGraphQLSettings,
    handleEditRelationships,
    openEditTableDrawer,
    openEditViewDrawer,
    openEditFunctionDrawer,
  } = dataBrowserActions;

  const { data: trackedTablesSet } = useGetTrackedTablesSet({
    dataSource: dataSourceSlug as string,
  });

  const { data: trackedFunctionsSet } = useGetTrackedFunctionsSet({
    dataSource: dataSourceSlug as string,
  });

  const { data: enumTablePaths } = useGetEnumsSet({
    dataSource: dataSourceSlug as string,
  });

  const isFunction = databaseObject.objectType === 'FUNCTION';
  const updatability = !isFunction ? databaseObject.updatability : undefined;
  const keyIdentifier = isFunction ? databaseObject.oid : databaseObject.name;
  const objectKey = `${databaseObject.objectType}.${databaseObject.schema}.${keyIdentifier}`;
  const isSelected = isFunction
    ? databaseObject.oid === functionOID
    : databaseObject.schema === schemaSlug && databaseObject.name === tableSlug;
  const isSidebarMenuOpen = sidebarMenuObject === objectKey;
  const tablePath = `${databaseObject.schema}.${databaseObject.name}`;
  const isEnum = Boolean(enumTablePaths?.has(tablePath));
  const isUntracked = isFunction
    ? !trackedFunctionsSet?.has(tablePath)
    : !trackedTablesSet?.has(tablePath);
  const isSelectedSchemaLocked = isSchemaLocked(databaseObject.schema);
  const DatabaseObjectIcon = getDatabaseObjectIcon(
    databaseObject.objectType,
    isEnum,
  );

  return (
    <li className="group pb-1">
      <Tooltip open={isUntracked ? undefined : false}>
        <TooltipTrigger asChild>
          <Button
            asChild
            variant="link"
            size="sm"
            disabled={objectKey === removableObject}
            className={cn(
              'flex w-full max-w-full justify-between pl-0 text-sm+ hover:bg-accent hover:no-underline',
              {
                'bg-table-selected': isSelected,
              },
            )}
          >
            <div>
              <NextLink
                className={cn(
                  'flex h-full w-[calc(100%-1.6rem)] items-center gap-1.5 p-[0.625rem] pr-0 text-left',
                  {
                    'text-primary-main': isSelected,
                  },
                )}
                onClick={() => {
                  onSidebarItemClick?.(`default.${objectKey}`);
                }}
                href={`/orgs/${orgSlug}/projects/${appSubdomain}/database/browser/default/${databaseObject.schema}/${getObjectTypeUrlSegment(databaseObject.objectType)}/${isFunction ? databaseObject.oid : databaseObject.name}`}
              >
                <DatabaseObjectIcon className="h-4 w-4 shrink-0" />
                <span
                  className={cn('!truncate text-ellipsis', {
                    italic: isUntracked,
                    'opacity-50': isUntracked && !isSelected,
                  })}
                >
                  {databaseObject.name}
                </span>
              </NextLink>
              <DatabaseObjectActions
                objectName={databaseObject.name}
                schema={databaseObject.schema}
                dataSource={dataSourceSlug as string}
                objectType={databaseObject.objectType}
                disabled={objectKey === removableObject}
                open={isSidebarMenuOpen}
                onOpen={() => setSidebarMenuObject(objectKey)}
                onClose={() => setSidebarMenuObject(undefined)}
                className={cn(
                  'relative z-10 opacity-0 group-hover:opacity-100',
                  {
                    'opacity-100': isSelected || isSidebarMenuOpen,
                  },
                )}
                isSelectedNotSchemaLocked={!isSelectedSchemaLocked}
                onEditPermissions={() =>
                  handleEditPermission(
                    databaseObject.schema,
                    databaseObject.name,
                    databaseObject.objectType,
                    updatability,
                  )
                }
                onEdit={() => {
                  if (isFunction) {
                    openEditFunctionDrawer(
                      databaseObject.schema,
                      databaseObject.name,
                      databaseObject.oid,
                    );
                  } else if (
                    ['MATERIALIZED VIEW', 'VIEW'].includes(
                      databaseObject.objectType,
                    )
                  ) {
                    openEditViewDrawer(
                      databaseObject.schema,
                      databaseObject.name,
                      databaseObject.objectType,
                    );
                  } else {
                    openEditTableDrawer(
                      databaseObject.schema,
                      databaseObject.name,
                    );
                  }
                }}
                onEditGraphQLSettings={() =>
                  handleEditGraphQLSettings(
                    databaseObject.schema,
                    databaseObject.name,
                    databaseObject.objectType,
                    isFunction ? databaseObject.oid : undefined,
                  )
                }
                onEditRelationships={() =>
                  handleEditRelationships(
                    databaseObject.schema,
                    databaseObject.name,
                  )
                }
                onDelete={() =>
                  handleDeleteDatabaseObject(
                    databaseObject.schema,
                    databaseObject.name,
                    databaseObject.objectType,
                    isFunction ? databaseObject.oid : undefined,
                  )
                }
              />
            </div>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          Not tracked in GraphQL
        </TooltipContent>
      </Tooltip>
    </li>
  );
}
