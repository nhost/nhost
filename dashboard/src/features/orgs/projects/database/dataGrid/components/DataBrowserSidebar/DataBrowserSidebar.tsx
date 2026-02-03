import {
  Info,
  List,
  Lock,
  Plus,
  SquareFunction,
  Table2,
  Terminal,
  View,
} from 'lucide-react';
import Image from 'next/image';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Backdrop } from '@/components/ui/v2/Backdrop';
import { Button } from '@/components/ui/v3/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { Spinner } from '@/components/ui/v3/spinner';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import {
  type DatabaseObject,
  useDataBrowserActions,
} from '@/features/orgs/projects/database/dataGrid/hooks/useDataBrowserActions';
import { useDatabaseQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery';
import { useMetadataQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useMetadataQuery';
import { isSchemaLocked } from '@/features/orgs/projects/database/dataGrid/utils/schemaHelpers';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { cn, isEmptyValue, isNotEmptyValue } from '@/lib/utils';
import FunctionActions from './FunctionActions';
import TableActions from './TableActions';
import ViewActions from './ViewActions';

export interface DataBrowserSidebarProps {
  className?: string;
}

export interface DataBrowserSidebarContentProps {
  onSidebarItemClick?: (tablePath?: string) => void;
}

function DataBrowserSidebarContent({
  onSidebarItemClick,
}: DataBrowserSidebarContentProps) {
  const { project } = useProject();
  const isGitHubConnected = !!project?.githubRepository;

  const router = useRouter();

  const {
    asPath,
    query: {
      orgSlug,
      appSubdomain,
      dataSourceSlug,
      schemaSlug,
      tableSlug,
      functionSlug,
    },
  } = router;

  const { data, status, error, refetch } = useDatabaseQuery([
    dataSourceSlug as string,
  ]);

  const { schemas, tables, views, materializedViews, functions, metadata } =
    data || {
      schemas: [],
      tables: [],
      views: [],
      materializedViews: [],
      functions: [],
    };

  // Get metadata to detect enum tables
  const { data: metadataData } = useMetadataQuery(
    ['export-metadata', dataSourceSlug as string],
    {
      queryOptions: {
        enabled: !!dataSourceSlug && !!project?.config?.hasura.adminSecret,
      },
    },
  );

  // Create a Set of enum table paths for quick lookup
  const enumTablePaths = new Set<string>();
  if (metadataData?.tables) {
    metadataData.tables.forEach((table) => {
      // biome-ignore lint/suspicious/noExplicitAny: Metadata table may have is_enum property
      if ((table as any).is_enum) {
        enumTablePaths.add(`${table.table.schema}.${table.table.name}`);
      }
    });
  }

  /**
   * Maps database object type to URL segment
   */
  function getObjectTypeUrlSegment(
    objectType: string,
  ): 'tables' | 'views' | 'functions' {
    if (objectType === 'FUNCTION') {
      return 'functions';
    }
    return 'tables';
  }

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

  // Merge tables, views, materialized views, and functions into a single list
  // This needs to be computed before the hook is called (even if data is empty)
  const allObjectsInSelectedSchema: DatabaseObject[] = [
    ...(tables || []).map((table) => ({
      table_schema: table.table_schema as string,
      table_name: table.table_name as string,
      object_type: (table.table_type as string) || 'BASE TABLE',
    })),
    ...(views || []).map((view) => ({
      table_schema: view.table_schema as string,
      table_name: view.table_name as string,
      object_type: 'VIEW',
    })),
    ...(materializedViews || []).map((mv) => ({
      table_schema: mv.table_schema as string,
      table_name: mv.table_name as string,
      object_type: 'MATERIALIZED VIEW',
    })),
    ...(functions || []).map((func) => ({
      table_schema: func.table_schema,
      table_name: func.table_name,
      object_type: 'FUNCTION',
    })),
  ]
    .filter(({ table_schema: tableSchema }) => tableSchema === selectedSchema)
    .sort((a, b) => {
      // Define type order: MATERIALIZED VIEW, VIEW, BASE TABLE (and other tables), FUNCTION
      const typeOrder: Record<string, number> = {
        'BASE TABLE': 0,
        'MATERIALIZED VIEW': 1,
        VIEW: 2,
        FUNCTION: 3,
      };

      const orderA = typeOrder[a.object_type] ?? 99;
      const orderB = typeOrder[b.object_type] ?? 99;

      // First sort by type
      if (orderA !== orderB) {
        return orderA - orderB;
      }

      // Then sort alphabetically by name
      return a.table_name.localeCompare(b.table_name);
    });

  // Use the hook for all action handlers (must be called unconditionally)
  const {
    removableTable,
    optimisticlyRemovedTable,
    sidebarMenuTable,
    setSidebarMenuTable,
    handleDeleteTableClick,
    handleDeleteFunctionClick,
    handleEditPermissionClick,
    handleEditFunctionPermissionClick,
    handleEditSettingsClick,
    handleEditFunctionSettingsClick,
    handleViewTableInfoClick,
    openEditTableDrawer,
    openEditViewDrawer,
    openEditFunctionDrawer,
    openCreateTableDrawer,
  } = useDataBrowserActions({
    dataSourceSlug: dataSourceSlug as string,
    schemaSlug: schemaSlug as string | undefined,
    tableSlug: tableSlug as string | undefined,
    functionSlug: functionSlug as string | undefined,
    selectedSchema,
    refetch,
    allObjects: allObjectsInSelectedSchema,
    functions: functions || [],
  });

  // Filter out optimistically removed tables from the displayed list
  const displayedObjects = allObjectsInSelectedSchema.filter(
    ({ table_schema: tableSchema, table_name: tableName }) =>
      `${tableSchema}.${tableName}` !== optimisticlyRemovedTable,
  );

  // Early returns must come AFTER all hooks are called
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
                    {(isSchemaLocked(schema.schema_name) ||
                      isGitHubConnected) && (
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
        {isGitHubConnected && (
          <div className="box mt-1.5 flex items-center gap-1 px-2">
            <Info className="h-4 w-4 text-disabled" />
            <p className="text-disabled text-xs">
              GitHub connected - use the CLI for schema changes
            </p>
          </div>
        )}
        {!isSelectedSchemaLocked && (
          <Button
            variant="link"
            className="!text-sm+ mt-1 flex w-full justify-between px-[0.625rem] text-primary hover:bg-accent hover:no-underline disabled:text-disabled"
            onClick={() => {
              openCreateTableDrawer();
              onSidebarItemClick?.();
            }}
            disabled={isGitHubConnected}
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
              {displayedObjects.map((dbObject) => {
                const objectPath = `${dbObject.object_type}.${dbObject.table_schema}.${dbObject.table_name}`;
                let isSelected = false;
                if (functionSlug) {
                  isSelected =
                    dbObject.object_type === 'FUNCTION' &&
                    dbObject.table_schema === schemaSlug &&
                    dbObject.table_name === functionSlug;
                } else if (tableSlug) {
                  isSelected =
                    dbObject.object_type !== 'FUNCTION' &&
                    dbObject.table_schema === schemaSlug &&
                    dbObject.table_name === tableSlug;
                }
                const isSidebarMenuOpen = sidebarMenuTable === objectPath;
                const isMaterializedView =
                  dbObject.object_type === 'MATERIALIZED VIEW';
                const isFunction = dbObject.object_type === 'FUNCTION';
                const isView = dbObject.object_type === 'VIEW';
                const tablePath = `${dbObject.table_schema}.${dbObject.table_name}`;
                const isEnum = enumTablePaths.has(tablePath);
                return (
                  <li className="group pb-1" key={objectPath}>
                    <Button
                      asChild
                      variant="link"
                      size="sm"
                      disabled={objectPath === removableTable}
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
                          href={`/orgs/${orgSlug}/projects/${appSubdomain}/database/browser/default/${dbObject.table_schema}/${getObjectTypeUrlSegment(dbObject.object_type)}/${dbObject.table_name}`}
                        >
                          {isFunction ? (
                            <SquareFunction className="h-4 w-4 shrink-0" />
                          ) : isMaterializedView || isView ? (
                            <View className="h-4 w-4 shrink-0" />
                          ) : isEnum ? (
                            <List className="h-4 w-4 shrink-0" />
                          ) : (
                            <Table2 className="h-4 w-4 shrink-0" />
                          )}
                          <span className="!truncate text-ellipsis">
                            {dbObject.table_name}
                          </span>
                        </NextLink>
                        {isFunction ? (
                          <FunctionActions
                            tableName={dbObject.table_name}
                            disabled={objectPath === removableTable}
                            open={isSidebarMenuOpen}
                            onOpen={() => setSidebarMenuTable(objectPath)}
                            onClose={() => setSidebarMenuTable(undefined)}
                            className={cn(
                              'relative z-10 opacity-0 group-hover:opacity-100',
                              {
                                'opacity-100': isSelected || isSidebarMenuOpen,
                              },
                            )}
                            isSelectedNotSchemaLocked={!isSelectedSchemaLocked}
                            onViewPermissions={() =>
                              handleEditFunctionPermissionClick(
                                dbObject.table_schema,
                                dbObject.table_name,
                                true,
                              )
                            }
                            onEditPermissions={() =>
                              handleEditFunctionPermissionClick(
                                dbObject.table_schema,
                                dbObject.table_name,
                              )
                            }
                            onEditFunction={() =>
                              openEditFunctionDrawer(
                                dbObject.table_schema,
                                dbObject.table_name,
                              )
                            }
                            onViewSettings={() =>
                              handleEditFunctionSettingsClick(
                                dbObject.table_schema,
                                dbObject.table_name,
                                true,
                              )
                            }
                            onEditSettings={() => {
                              handleEditFunctionSettingsClick(
                                dbObject.table_schema,
                                dbObject.table_name,
                                false,
                              );
                            }}
                            onDelete={() =>
                              handleDeleteFunctionClick(
                                dbObject.table_schema,
                                dbObject.table_name,
                              )
                            }
                          />
                        ) : isMaterializedView || isView ? (
                          <ViewActions
                            tableName={dbObject.table_name}
                            disabled={objectPath === removableTable}
                            open={isSidebarMenuOpen}
                            onOpen={() => setSidebarMenuTable(objectPath)}
                            onClose={() => setSidebarMenuTable(undefined)}
                            className={cn(
                              'relative z-10 opacity-0 group-hover:opacity-100',
                              {
                                'opacity-100': isSelected || isSidebarMenuOpen,
                              },
                            )}
                            isSelectedNotSchemaLocked={!isSelectedSchemaLocked}
                            onViewPermissions={() =>
                              handleEditPermissionClick(
                                dbObject.table_schema,
                                dbObject.table_name,
                                true,
                              )
                            }
                            onViewSettings={() =>
                              handleEditSettingsClick(
                                dbObject.table_schema,
                                dbObject.table_name,
                                true,
                                dbObject.object_type,
                              )
                            }
                            onEditView={() =>
                              openEditViewDrawer(
                                dbObject.table_schema,
                                dbObject,
                              )
                            }
                            onEditPermissions={() =>
                              handleEditPermissionClick(
                                dbObject.table_schema,
                                dbObject.table_name,
                              )
                            }
                            onEditSettings={() => {
                              handleEditSettingsClick(
                                dbObject.table_schema,
                                dbObject.table_name,
                                false,
                                dbObject.object_type,
                              );
                            }}
                            onDelete={() =>
                              handleDeleteTableClick(
                                dbObject.table_schema,
                                dbObject.table_name,
                              )
                            }
                          />
                        ) : (
                          <TableActions
                            tableName={dbObject.table_name}
                            disabled={objectPath === removableTable}
                            open={isSidebarMenuOpen}
                            onOpen={() => setSidebarMenuTable(objectPath)}
                            onClose={() => setSidebarMenuTable(undefined)}
                            className={cn(
                              'relative z-10 opacity-0 group-hover:opacity-100',
                              {
                                'opacity-100': isSelected || isSidebarMenuOpen,
                              },
                            )}
                            isSelectedNotSchemaLocked={!isSelectedSchemaLocked}
                            onViewInfo={() =>
                              handleViewTableInfoClick(
                                dbObject.table_schema,
                                dbObject.table_name,
                              )
                            }
                            onViewPermissions={() =>
                              handleEditPermissionClick(
                                dbObject.table_schema,
                                dbObject.table_name,
                                true,
                              )
                            }
                            onViewSettings={() =>
                              handleEditSettingsClick(
                                dbObject.table_schema,
                                dbObject.table_name,
                                true,
                                dbObject.object_type,
                              )
                            }
                            onEditTable={() =>
                              openEditTableDrawer(
                                dbObject.table_schema,
                                dbObject.table_name,
                              )
                            }
                            onEditPermissions={() =>
                              handleEditPermissionClick(
                                dbObject.table_schema,
                                dbObject.table_name,
                              )
                            }
                            onEditSettings={() => {
                              handleEditSettingsClick(
                                dbObject.table_schema,
                                dbObject.table_name,
                                false,
                                dbObject.object_type,
                              );
                            }}
                            onDelete={() =>
                              handleDeleteTableClick(
                                dbObject.table_schema,
                                dbObject.table_name,
                              )
                            }
                          />
                        )}
                      </div>
                    </Button>
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

export default function DataBrowserSidebar({
  className,
}: DataBrowserSidebarProps) {
  const isPlatform = useIsPlatform();
  const { project } = useProject();

  const [expanded, setExpanded] = useState(false);

  function toggleExpanded() {
    setExpanded(!expanded);
  }

  function handleSidebarItemClick() {
    setExpanded(false);
  }

  useEffect(() => {
    function closeSidebarWhenEscapeIsPressed(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setExpanded(false);
      }
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', closeSidebarWhenEscapeIsPressed);
    }

    return () =>
      document.removeEventListener('keydown', closeSidebarWhenEscapeIsPressed);
  }, []);

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return null;
  }

  return (
    <>
      <Backdrop
        open={expanded}
        className="absolute top-0 right-0 bottom-0 left-0 z-[34] sm:hidden"
        role="button"
        tabIndex={-1}
        onClick={() => setExpanded(false)}
        aria-label="Close sidebar overlay"
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') {
            return;
          }

          setExpanded(false);
        }}
      />

      <aside
        className={cn(
          'box absolute top-0 z-[35] h-full w-full overflow-auto border-r-1 pt-2 pb-17 motion-safe:transition-transform sm:relative sm:z-0 sm:h-full sm:pt-2.5 sm:pb-0 sm:transition-none',
          expanded ? 'translate-x-0' : '-translate-x-full sm:translate-x-0',
          className,
        )}
      >
        <RetryableErrorBoundary>
          <DataBrowserSidebarContent
            onSidebarItemClick={handleSidebarItemClick}
          />
        </RetryableErrorBoundary>
      </aside>

      <Button
        variant="outline"
        size="icon"
        className="absolute bottom-4 left-8 z-[38] h-11 w-11 rounded-full bg-primary md:hidden"
        onClick={toggleExpanded}
        aria-label="Toggle sidebar"
      >
        <Image
          width={16}
          height={16}
          src="/assets/table.svg"
          alt="A monochrome table"
        />
      </Button>
    </>
  );
}
