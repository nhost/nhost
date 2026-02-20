import { useQueryClient } from '@tanstack/react-query';
import { Info, Lock, Plus, Terminal } from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { FormActivityIndicator } from '@/components/form/FormActivityIndicator';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Backdrop } from '@/components/ui/v2/Backdrop';
import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
import { InlineCode } from '@/components/ui/v3/inline-code';
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
import { EditGraphQLSettingsForm } from '@/features/orgs/projects/database/dataGrid/components/EditGraphQLSettingsForm';
import { EditRelationshipsForm } from '@/features/orgs/projects/database/dataGrid/EditRelationshipsForm';
import { useDatabaseQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery';
import { useDeleteTableWithToastMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useDeleteTableMutation';
import { useGetTrackedTablesSet } from '@/features/orgs/projects/database/dataGrid/hooks/useGetTrackedTablesSet';
import { isSchemaLocked } from '@/features/orgs/projects/database/dataGrid/utils/schemaHelpers';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { cn, isEmptyValue, isNotEmptyValue } from '@/lib/utils';
import TableActions from './TableActions';

const CreateTableForm = dynamic(
  () =>
    import(
      '@/features/orgs/projects/database/dataGrid/components/CreateTableForm/CreateTableForm'
    ),
  {
    ssr: false,
    loading: () => <FormActivityIndicator />,
  },
);

const EditTableForm = dynamic(
  () =>
    import(
      '@/features/orgs/projects/database/dataGrid/components/EditTableForm/EditTableForm'
    ),
  {
    ssr: false,
    loading: () => <FormActivityIndicator />,
  },
);

const EditPermissionsForm = dynamic(
  () =>
    import(
      '@/features/orgs/projects/database/dataGrid/components/EditPermissionsForm/EditPermissionsForm'
    ),
  {
    ssr: false,
    loading: () => <FormActivityIndicator />,
  },
);

export interface DataBrowserSidebarProps {
  className?: string;
}

export interface DataBrowserSidebarContentProps {
  onSidebarItemClick?: (tablePath?: string) => void;
}

function DataBrowserSidebarContent({
  onSidebarItemClick,
}: DataBrowserSidebarContentProps) {
  const queryClient = useQueryClient();
  const { openDrawer, openAlertDialog } = useDialog();
  const { project } = useProject();
  const isGitHubConnected = !!project?.githubRepository;

  const router = useRouter();

  const {
    asPath,
    query: { orgSlug, appSubdomain, dataSourceSlug, schemaSlug, tableSlug },
  } = router;

  const { data: trackedTablesSet } = useGetTrackedTablesSet({
    dataSource: dataSourceSlug as string,
  });

  const { data, status, error, refetch } = useDatabaseQuery([
    dataSourceSlug as string,
  ]);

  const { schemas, tables, metadata } = data || { schemas: [], tables: [] };

  const { mutateAsync: deleteTable } = useDeleteTableWithToastMutation();

  const [removableTable, setRemovableTable] = useState<string>();
  const [optimisticlyRemovedTable, setOptimisticlyRemovedTable] =
    useState<string>();

  const [selectedSchema, setSelectedSchema] = useState<string>('');
  const isSelectedSchemaLocked = isSchemaLocked(selectedSchema);

  /**
   * Table for which the table management dropdown was opened.
   */
  const [sidebarMenuTable, setSidebarMenuTable] = useState<string>();

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

  const tablesInSelectedSchema = tables
    ?.filter(({ table_schema: tableSchema }) => tableSchema === selectedSchema)
    .filter(
      ({ table_schema: tableSchema, table_name: tableName }) =>
        `${tableSchema}.${tableName}` !== optimisticlyRemovedTable,
    );

  async function handleDeleteTableConfirmation(schema: string, table: string) {
    const tablePath = `${schema}.${table}`;

    // We are greying out and disabling it in the sidebar
    setRemovableTable(tablePath);

    try {
      let nextTableIndex: number | null = null;

      if (
        isNotEmptyValue(tablesInSelectedSchema) &&
        tablesInSelectedSchema.length > 1
      ) {
        // We go to the next table if available or to the previous one if the
        // current one is the last one in the list
        const currentTableIndex = tablesInSelectedSchema.findIndex(
          ({ table_schema: tableSchema, table_name: tableName }) =>
            `${tableSchema}.${tableName}` === tablePath,
        );

        nextTableIndex = currentTableIndex + 1;

        if (currentTableIndex + 1 === tablesInSelectedSchema.length) {
          nextTableIndex = currentTableIndex - 1;
        }
      }

      const nextTable =
        isNotEmptyValue(nextTableIndex) &&
        isNotEmptyValue(tablesInSelectedSchema)
          ? tablesInSelectedSchema[nextTableIndex]
          : null;

      await deleteTable({ schema, table });
      queryClient.removeQueries({
        queryKey: [`${dataSourceSlug}.${schema}.${table}`],
      });

      // Note: At this point we can optimisticly assume that the table was
      // removed, so we can improve the UX by removing it from the list right
      // away, without waiting for the refetch to succeed.
      setOptimisticlyRemovedTable(tablePath);
      await refetch();

      // If this was the last table in the schema, we go back to the data
      // browser's main screen
      if (!nextTable) {
        await router.push(
          `/orgs/${orgSlug}/projects/${appSubdomain}/database/browser/${dataSourceSlug}`,
        );

        return;
      }

      if (schema === schemaSlug && table === tableSlug) {
        await router.push(
          `/orgs/${orgSlug}/projects/${appSubdomain}/database/browser/${dataSourceSlug}/${nextTable.table_schema}/${nextTable.table_name}`,
        );
      }
    } catch {
      // TODO: Introduce logging
    } finally {
      setRemovableTable(undefined);
      setOptimisticlyRemovedTable(undefined);
    }
  }

  function handleDeleteTableClick(schema: string, table: string) {
    openAlertDialog({
      title: 'Delete Table',
      payload: (
        <span>
          Are you sure you want to delete the{' '}
          <strong className="break-all">{table}</strong> table?
        </span>
      ),
      props: {
        primaryButtonText: 'Delete',
        primaryButtonColor: 'error',
        onPrimaryAction: () => handleDeleteTableConfirmation(schema, table),
      },
    });
  }

  function handleEditPermissionClick(
    schema: string,
    table: string,
    disabled?: boolean,
  ) {
    openDrawer({
      title: (
        <span className="inline-grid grid-flow-col items-center gap-2">
          Permissions
          <InlineCode className="!text-sm+ font-normal">{table}</InlineCode>
          <Badge
            variant="secondary"
            className="bg-[#ebf3ff] text-primary dark:bg-[#1b2534]"
          >
            Preview
          </Badge>
        </span>
      ),
      component: (
        <EditPermissionsForm
          disabled={disabled}
          schema={schema}
          table={table}
        />
      ),
      props: {
        PaperProps: {
          className: 'lg:w-[65%] lg:max-w-7xl',
        },
      },
    });
  }

  function handleEditSettingsClick(
    schema: string,
    table: string,
    disabled?: boolean,
  ) {
    openDrawer({
      title: (
        <span className="inline-grid grid-flow-col items-center gap-2">
          {disabled ? 'View GraphQL settings for' : 'Edit GraphQL settings for'}
          <InlineCode className="!text-sm+ font-normal">{table}</InlineCode>
          table
        </span>
      ),
      component: (
        <EditGraphQLSettingsForm
          disabled={disabled}
          schema={schema}
          tableName={table}
        />
      ),
      props: {
        PaperProps: {
          className: 'overflow-hidden ',
        },
      },
    });
  }

  function handleRelationshipsClick(
    schema: string,
    table: string,
    disabled?: boolean,
  ) {
    openDrawer({
      title: `${disabled ? 'View' : 'Edit'} Relationships`,
      component: (
        <EditRelationshipsForm
          schema={schema}
          table={table}
          disabled={disabled}
        />
      ),
      props: {
        PaperProps: {
          className: 'overflow-hidden',
        },
      },
    });
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
              openDrawer({
                title: 'Create a New Table',
                component: (
                  <CreateTableForm onSubmit={refetch} schema={selectedSchema} />
                ),
              });
              onSidebarItemClick?.();
            }}
            disabled={isGitHubConnected}
          >
            New Table <Plus className="h-4 w-4" />
          </Button>
        )}
        {isNotEmptyValue(schemas) && isEmptyValue(tablesInSelectedSchema) && (
          <p className="px-2 py-1.5 text-disabled text-xs">No tables found.</p>
        )}
        <nav aria-label="Database navigation">
          {isNotEmptyValue(tablesInSelectedSchema) && (
            <ul className="w-full max-w-full pb-6">
              {tablesInSelectedSchema.map((table) => {
                const tablePath = `${table.table_schema}.${table.table_name}`;
                const isSelected = `${schemaSlug}.${tableSlug}` === tablePath;
                const isSidebarMenuOpen = sidebarMenuTable === tablePath;
                const isUntracked = !trackedTablesSet?.has(
                  `${table.table_schema}.${table.table_name}`,
                );

                return (
                  <li className="group pb-1" key={tablePath}>
                    <Tooltip open={isUntracked ? undefined : false}>
                      <TooltipTrigger asChild>
                        <Button
                          asChild
                          variant="link"
                          size="sm"
                          disabled={tablePath === removableTable}
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
                                'flex h-full w-[calc(100%-1.6rem)] items-center p-[0.625rem] pr-0 text-left',
                                {
                                  'text-primary-main': isSelected,
                                },
                              )}
                              onClick={() => {
                                if (onSidebarItemClick) {
                                  onSidebarItemClick(`default.${tablePath}`);
                                }
                              }}
                              href={`/orgs/${orgSlug}/projects/${appSubdomain}/database/browser/default/${table.table_schema}/${table.table_name}`}
                            >
                              <span
                                className={cn('!truncate text-ellipsis', {
                                  italic: isUntracked,
                                  'opacity-50': isUntracked && !isSelected,
                                })}
                              >
                                {table.table_name}
                              </span>
                            </NextLink>
                            <TableActions
                              tableName={table.table_name}
                              schema={table.table_schema}
                              dataSource={dataSourceSlug as string}
                              disabled={tablePath === removableTable}
                              open={isSidebarMenuOpen}
                              onOpen={() => setSidebarMenuTable(tablePath)}
                              onClose={() => setSidebarMenuTable(undefined)}
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
                              onViewPermissions={() =>
                                handleEditPermissionClick(
                                  table.table_schema,
                                  table.table_name,
                                  true,
                                )
                              }
                              onViewSettings={() =>
                                handleEditSettingsClick(
                                  table.table_schema,
                                  table.table_name,
                                  true,
                                )
                              }
                              onViewRelationships={() =>
                                handleRelationshipsClick(
                                  table.table_schema,
                                  table.table_name,
                                  true,
                                )
                              }
                              onEditTable={() =>
                                openDrawer({
                                  title: 'Edit Table',
                                  component: (
                                    <EditTableForm
                                      onSubmit={async (tableName) => {
                                        await queryClient.refetchQueries({
                                          queryKey: [
                                            `${dataSourceSlug}.${table.table_schema}.${tableName}`,
                                          ],
                                        });
                                        await refetch();
                                      }}
                                      schema={table.table_schema}
                                      table={table}
                                    />
                                  ),
                                })
                              }
                              onEditPermissions={() =>
                                handleEditPermissionClick(
                                  table.table_schema,
                                  table.table_name,
                                )
                              }
                              onEditSettings={() => {
                                handleEditSettingsClick(
                                  table.table_schema,
                                  table.table_name,
                                  false,
                                );
                              }}
                              onEditRelationships={() => {
                                handleRelationshipsClick(
                                  table.table_schema,
                                  table.table_name,
                                );
                              }}
                              onDelete={() =>
                                handleDeleteTableClick(
                                  table.table_schema,
                                  table.table_name,
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
