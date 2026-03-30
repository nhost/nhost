import { Lock, Plus, Terminal } from 'lucide-react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { FeatureSidebar } from '@/components/layout/FeatureSidebar';
import { Button } from '@/components/ui/v3/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { Spinner } from '@/components/ui/v3/spinner';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useDataBrowserActions } from '@/features/orgs/projects/database/dataGrid/hooks/useDataBrowserActions';
import { useDatabaseQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery';
import { useGetEnumsSet } from '@/features/orgs/projects/database/dataGrid/hooks/useGetEnumsSet';
import { useGetTrackedTablesSet } from '@/features/orgs/projects/database/dataGrid/hooks/useGetTrackedTablesSet';
import type { DatabaseObjectViewModel } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getDatabaseObjectIcon } from '@/features/orgs/projects/database/dataGrid/utils/getDatabaseObjectIcon';

import { isSchemaLocked } from '@/features/orgs/projects/database/dataGrid/utils/schemaHelpers';
import { sortDatabaseObjects } from '@/features/orgs/projects/database/dataGrid/utils/sortDatabaseObjects';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { cn, isEmptyValue, isNotEmptyValue } from '@/lib/utils';
import DatabaseObjectActions from './DatabaseObjectActions';

export interface DataBrowserSidebarContentProps {
  onSidebarItemClick?: (tablePath?: string) => void;
}

function DataBrowserSidebarContent({
  onSidebarItemClick,
}: DataBrowserSidebarContentProps) {
  const router = useRouter();

  const {
    asPath,
    query: { orgSlug, appSubdomain, dataSourceSlug, schemaSlug, tableSlug },
  } = router;

  const { data: trackedTablesSet } = useGetTrackedTablesSet({
    dataSource: dataSourceSlug as string,
  });

  const { data: enumTablePaths } = useGetEnumsSet({
    dataSource: dataSourceSlug as string,
  });

  const {
    data,
    status,
    error,
    refetch: refetchDatabaseQuery,
  } = useDatabaseQuery([dataSourceSlug as string]);

  const { schemas, tableLikeObjects, metadata } = data || {
    schemas: [],
  };

  const [selectedSchema, setSelectedSchema] = useState<string>('');
  const isSelectedSchemaLocked = isSchemaLocked(selectedSchema);

  const sqlEditorHref = `/orgs/${orgSlug}/projects/${appSubdomain}/database/browser/default/editor`;

  useEffect(() => {
    if (selectedSchema) {
      return;
    }

    if (schemaSlug) {
      setSelectedSchema(schemaSlug as string);
      return;
    }

    if (schemas && schemas.length > 0) {
      const publicSchemaIndex = schemas.findIndex(
        ({ schema_name: schemaName }) => schemaName === 'public',
      );
      const index = Math.max(0, publicSchemaIndex);
      setSelectedSchema(schemas[index].schema_name);
    }
  }, [schemaSlug, schemas, selectedSchema]);

  const allObjectsInSelectedSchema: DatabaseObjectViewModel[] =
    sortDatabaseObjects(
      (tableLikeObjects || [])
        .filter((obj) => obj.table_schema === selectedSchema)
        .map((obj) => ({
          schema: obj.table_schema,
          name: obj.table_name,
          objectType: obj.table_type || 'ORDINARY TABLE',
          updatability: obj.updatability,
        })),
      enumTablePaths,
    );

  const {
    removableObject,
    optimisticlyRemovedObject,
    sidebarMenuObject,
    setSidebarMenuObject,
    handleDeleteDatabaseObject,
    handleEditPermission,
    handleEditGraphQLSettings,
    handleEditRelationships,
    openEditTableDrawer,
    openEditViewDrawer,
    openCreateTableDrawer,
  } = useDataBrowserActions({
    dataSourceSlug: dataSourceSlug as string,
    schemaSlug: schemaSlug as string | undefined,
    tableSlug: tableSlug as string | undefined,
    selectedSchema,
    refetchDatabaseQuery,
    allObjects: allObjectsInSelectedSchema,
  });

  const displayedObjects = allObjectsInSelectedSchema.filter(
    ({ schema: tableSchema, name: tableName }) =>
      `${tableSchema}.${tableName}` !== optimisticlyRemovedObject,
  );

  if (status === 'loading') {
    return (
      <Spinner
        wrapperClassName="flex-row text-[12px] leading-[1.66] font-normal gap-1"
        className="h-4 w-4 justify-center"
      >
        Loading schemas and tables...
      </Spinner>
    );
  }

  if (status === 'error') {
    throw error || new Error('Unknown error occurred. Please try again later.');
  }

  if (metadata?.databaseNotFound) {
    return null;
  }

  return (
    <div className="flex h-full flex-col justify-between">
      <div className="box flex flex-col px-2">
        {schemas && schemas.length > 0 && (
          <Select value={selectedSchema} onValueChange={setSelectedSchema}>
            <SelectTrigger className="w-full min-w-[initial] max-w-[220px]">
              <SelectValue placeholder="Is null?" />
            </SelectTrigger>
            <SelectContent>
              {schemas.map((schema) => (
                <SelectItem value={schema.schema_name} key={schema.schema_name}>
                  <div className="flex items-center gap-2">
                    <p className="text-sm">
                      <span className="text-disabled">schema.</span>
                      <span className="font-medium">{schema.schema_name}</span>
                    </p>
                    {isSchemaLocked(schema.schema_name) && (
                      <Lock
                        className="text-[#556378] dark:text-[#a2b3be]"
                        size={12}
                      />
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {!isSelectedSchemaLocked && (
          <Button
            variant="link"
            className="!text-sm+ mt-1 flex w-full justify-between px-[0.625rem] text-primary hover:bg-accent hover:no-underline disabled:text-disabled"
            onClick={() => {
              openCreateTableDrawer();
              onSidebarItemClick?.();
            }}
          >
            New Table <Plus className="h-4 w-4" />
          </Button>
        )}
        {isNotEmptyValue(schemas) && isEmptyValue(displayedObjects) && (
          <p className="px-2 py-1.5 text-disabled text-xs">No tables found.</p>
        )}
        <nav aria-label="Database navigation">
          {isNotEmptyValue(displayedObjects) && (
            <ul className="w-full max-w-full pb-6">
              {displayedObjects.map((databaseObject) => {
                const objectPath = `${databaseObject.objectType}.${databaseObject.schema}.${databaseObject.name}`;
                const isSelected =
                  databaseObject.schema === schemaSlug &&
                  databaseObject.name === tableSlug;
                const isSidebarMenuOpen = sidebarMenuObject === objectPath;
                const tablePath = `${databaseObject.schema}.${databaseObject.name}`;
                const isEnum = Boolean(enumTablePaths?.has(tablePath));
                const isUntracked = !trackedTablesSet?.has(tablePath);
                const DatabaseObjectIcon = getDatabaseObjectIcon(
                  databaseObject.objectType,
                  isEnum,
                );
                return (
                  <li className="group pb-1" key={objectPath}>
                    <Tooltip open={isUntracked ? undefined : false}>
                      <TooltipTrigger asChild>
                        <Button
                          asChild
                          variant="link"
                          size="sm"
                          disabled={objectPath === removableObject}
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
                                if (onSidebarItemClick) {
                                  onSidebarItemClick(`default.${objectPath}`);
                                }
                              }}
                              href={`/orgs/${orgSlug}/projects/${appSubdomain}/database/browser/default/${databaseObject.schema}/tables/${databaseObject.name}`}
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
                              tableName={databaseObject.name}
                              schema={databaseObject.schema}
                              dataSource={dataSourceSlug as string}
                              objectType={databaseObject.objectType}
                              open={isSidebarMenuOpen}
                              onOpen={() => setSidebarMenuObject(objectPath)}
                              onClose={() => setSidebarMenuObject(undefined)}
                              disabled={objectPath === removableObject}
                              className={cn(
                                'relative z-10 opacity-0 group-hover:opacity-100',
                                {
                                  'opacity-100':
                                    isSelected || isSidebarMenuOpen,
                                },
                              )}
                              isSelectedNotSchemaLocked={
                                !isSelectedSchemaLocked
                              }
                              onEditPermissions={() =>
                                handleEditPermission(
                                  databaseObject.schema,
                                  databaseObject.name,
                                  databaseObject.objectType,
                                  databaseObject.updatability,
                                )
                              }
                              onEdit={() =>
                                ['MATERIALIZED VIEW', 'VIEW'].includes(
                                  databaseObject.objectType,
                                )
                                  ? openEditViewDrawer(
                                      databaseObject.schema,
                                      databaseObject.name,
                                      databaseObject.objectType,
                                    )
                                  : openEditTableDrawer(
                                      databaseObject.schema,
                                      databaseObject.name,
                                    )
                              }
                              onEditGraphQLSettings={() =>
                                handleEditGraphQLSettings(
                                  databaseObject.schema,
                                  databaseObject.name,
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
              })}
            </ul>
          )}
        </nav>
      </div>

      <div className="box border-t">
        <Button
          size="sm"
          variant="link"
          asChild
          className={cn(
            'flex rounded-none border text-sm+ hover:bg-accent hover:no-underline group-focus-within:pr-9 group-hover:pr-9 group-active:pr-9',
            { 'bg-table-selected text-primary-main': asPath === sqlEditorHref },
          )}
        >
          <NextLink href={sqlEditorHref}>
            <div className="flex w-full flex-row items-center justify-center space-x-4">
              <Terminal />
              <span className="flex">SQL Editor</span>
            </div>
          </NextLink>
        </Button>
      </div>
    </div>
  );
}

export default function DataBrowserSidebar() {
  const isPlatform = useIsPlatform();
  const { project } = useProject();

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return null;
  }

  return (
    <FeatureSidebar toggleOffset="left-8" className="box">
      {(collapse) => (
        <DataBrowserSidebarContent onSidebarItemClick={collapse} />
      )}
    </FeatureSidebar>
  );
}
