import { useDialog } from '@/components/common/DialogProvider';
import { NavLink } from '@/components/common/NavLink';
import { FormActivityIndicator } from '@/components/form/FormActivityIndicator';
import { InlineCode } from '@/components/presentational/InlineCode';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Backdrop } from '@/components/ui/v2/Backdrop';
import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Chip } from '@/components/ui/v2/Chip';
import { Divider } from '@/components/ui/v2/Divider';
import { Dropdown } from '@/components/ui/v2/Dropdown';
import { IconButton } from '@/components/ui/v2/IconButton';
import { DotsHorizontalIcon } from '@/components/ui/v2/icons/DotsHorizontalIcon';
import { LockIcon } from '@/components/ui/v2/icons/LockIcon';
import { PencilIcon } from '@/components/ui/v2/icons/PencilIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TerminalIcon } from '@/components/ui/v2/icons/TerminalIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { UsersIcon } from '@/components/ui/v2/icons/UsersIcon';
import { List } from '@/components/ui/v2/List';
import { ListItem } from '@/components/ui/v2/ListItem';
import { Option } from '@/components/ui/v2/Option';
import { Select } from '@/components/ui/v2/Select';
import { Text } from '@/components/ui/v2/Text';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useDatabaseQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery';
import { useDeleteTableWithToastMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useDeleteTableMutation';
import { isSchemaLocked } from '@/features/orgs/projects/database/dataGrid/utils/schemaHelpers';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { twMerge } from 'tailwind-merge';

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

export interface DataBrowserSidebarProps extends Omit<BoxProps, 'children'> {
  /**
   * Function to be called when a sidebar item is clicked.
   */
  onSidebarItemClick?: (tablePath?: string) => void;
}

function DataBrowserSidebarContent({
  onSidebarItemClick,
}: Pick<DataBrowserSidebarProps, 'onSidebarItemClick'>) {
  const queryClient = useQueryClient();
  const { openDrawer, openAlertDialog } = useDialog();
  const { project } = useProject();
  const isGitHubConnected = !!project?.githubRepository;

  const router = useRouter();

  const {
    asPath,
    query: { orgSlug, appSubdomain, dataSourceSlug, schemaSlug, tableSlug },
  } = router;

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
      <ActivityIndicator
        delay={1000}
        label="Loading schemas and tables..."
        className="justify-center"
      />
    );
  }

  if (status === 'error') {
    throw error || new Error('Unknown error occurred. Please try again later.');
  }

  if (metadata?.databaseNotFound) {
    return null;
  }

  const tablesInSelectedSchema = tables
    .filter(({ table_schema: tableSchema }) => tableSchema === selectedSchema)
    .filter(
      ({ table_schema: tableSchema, table_name: tableName }) =>
        `${tableSchema}.${tableName}` !== optimisticlyRemovedTable,
    );

  async function handleDeleteTableConfirmation(schema: string, table: string) {
    const tablePath = `${schema}.${table}`;

    // We are greying out and disabling it in the sidebar
    setRemovableTable(tablePath);

    try {
      let nextTableIndex = null;

      if (tablesInSelectedSchema.length > 1) {
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

      const nextTable = nextTableIndex
        ? tablesInSelectedSchema[nextTableIndex]
        : null;

      await deleteTable({ schema, table });
      queryClient.removeQueries([`${dataSourceSlug}.${schema}.${table}`]);

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
          <Chip label="Preview" size="small" color="info" component="span" />
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

  return (
    <Box className="flex h-full flex-col justify-between">
      <Box className="flex flex-col px-2">
        {schemas && schemas.length > 0 && (
          <Select
            renderValue={(option) => (
              <span className="grid grid-flow-col items-center gap-1">
                {option?.label}
              </span>
            )}
            slotProps={{
              listbox: { className: 'max-w-[220px] min-w-[initial] w-full' },
              popper: { className: 'max-w-[220px] min-w-[initial] w-full' },
            }}
            value={selectedSchema}
            onChange={(_event, value) => setSelectedSchema(value as string)}
          >
            {schemas.map((schema) => (
              <Option
                className="grid grid-flow-col items-center gap-1"
                value={schema.schema_name}
                key={schema.schema_name}
              >
                <Text className="text-sm">
                  <Text component="span" color="disabled">
                    schema.
                  </Text>
                  <Text component="span" className="font-medium">
                    {schema.schema_name}
                  </Text>
                </Text>
                {(isSchemaLocked(schema.schema_name) || isGitHubConnected) && (
                  <LockIcon
                    className="h-3 w-3"
                    sx={{ color: 'text.secondary' }}
                  />
                )}
              </Option>
            ))}
          </Select>
        )}
        {isGitHubConnected && (
          <Box
            className="mt-1.5 grid grid-flow-row justify-items-start gap-2 rounded-md p-2"
            sx={{ backgroundColor: 'grey.200' }}
          >
            <Text>
              Your project is connected to GitHub. Please use the CLI to make
              schema changes.
            </Text>
          </Box>
        )}
        {!isSelectedSchemaLocked && (
          <Button
            variant="borderless"
            endIcon={<PlusIcon />}
            className="mt-1 w-full justify-between px-2"
            onClick={() => {
              openDrawer({
                title: 'Create a New Table',
                component: (
                  <CreateTableForm onSubmit={refetch} schema={selectedSchema} />
                ),
              });
              onSidebarItemClick();
            }}
            disabled={isGitHubConnected}
          >
            New Table
          </Button>
        )}
        {schemas &&
          schemas.length > 0 &&
          tablesInSelectedSchema.length === 0 && (
            <Text className="px-2 py-1.5 text-xs" color="disabled">
              No tables found.
            </Text>
          )}
        <nav aria-label="Database navigation">
          {tablesInSelectedSchema.length > 0 && (
            <List className="grid gap-1 pb-6">
              {tablesInSelectedSchema.map((table) => {
                const tablePath = `${table.table_schema}.${table.table_name}`;
                const isSelected = `${schemaSlug}.${tableSlug}` === tablePath;
                const isSidebarMenuOpen = sidebarMenuTable === tablePath;
                return (
                  <ListItem.Root
                    className="group"
                    key={tablePath}
                    secondaryAction={
                      <Dropdown.Root
                        id="table-management-menu"
                        onOpen={() => setSidebarMenuTable(tablePath)}
                        onClose={() => setSidebarMenuTable(undefined)}
                      >
                        <Dropdown.Trigger
                          asChild
                          hideChevron
                          disabled={tablePath === removableTable}
                        >
                          <IconButton
                            variant="borderless"
                            color={isSelected ? 'primary' : 'secondary'}
                            className={twMerge(
                              !isSelected &&
                                'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 group-active:opacity-100',
                            )}
                          >
                            <DotsHorizontalIcon />
                          </IconButton>
                        </Dropdown.Trigger>
                        <Dropdown.Content
                          menu
                          PaperProps={{ className: 'w-52' }}
                        >
                          {isGitHubConnected ? (
                            <Dropdown.Item
                              className="grid grid-flow-col items-center gap-2 p-2 text-sm+ font-medium"
                              onClick={() =>
                                handleEditPermissionClick(
                                  table.table_schema,
                                  table.table_name,
                                  true,
                                )
                              }
                            >
                              <UsersIcon
                                className="h-4 w-4"
                                sx={{ color: 'text.secondary' }}
                              />
                              <span>View Permissions</span>
                            </Dropdown.Item>
                          ) : (
                            [
                              !isSelectedSchemaLocked && (
                                <Dropdown.Item
                                  key="edit-table"
                                  className="grid grid-flow-col items-center gap-2 p-2 text-sm+ font-medium"
                                  onClick={() =>
                                    openDrawer({
                                      title: 'Edit Table',
                                      component: (
                                        <EditTableForm
                                          onSubmit={async () => {
                                            await queryClient.refetchQueries([
                                              `${dataSourceSlug}.${table.table_schema}.${table.table_name}`,
                                            ]);
                                            await refetch();
                                          }}
                                          schema={table.table_schema}
                                          table={table}
                                        />
                                      ),
                                    })
                                  }
                                >
                                  <PencilIcon
                                    className="h-4 w-4"
                                    sx={{ color: 'text.secondary' }}
                                  />
                                  <span>Edit Table</span>
                                </Dropdown.Item>
                              ),
                              !isSelectedSchemaLocked && (
                                <Divider
                                  key="edit-table-separator"
                                  component="li"
                                />
                              ),
                              <Dropdown.Item
                                key="edit-permissions"
                                className="grid grid-flow-col items-center gap-2 p-2 text-sm+ font-medium"
                                onClick={() =>
                                  handleEditPermissionClick(
                                    table.table_schema,
                                    table.table_name,
                                  )
                                }
                              >
                                <UsersIcon
                                  className="h-4 w-4"
                                  sx={{ color: 'text.secondary' }}
                                />
                                <span>Edit Permissions</span>
                              </Dropdown.Item>,
                              !isSelectedSchemaLocked && (
                                <Divider
                                  key="edit-permissions-separator"
                                  component="li"
                                />
                              ),
                              !isSelectedSchemaLocked && (
                                <Dropdown.Item
                                  key="delete-table"
                                  className="grid grid-flow-col items-center gap-2 p-2 text-sm+ font-medium"
                                  sx={{ color: 'error.main' }}
                                  onClick={() =>
                                    handleDeleteTableClick(
                                      table.table_schema,
                                      table.table_name,
                                    )
                                  }
                                >
                                  <TrashIcon
                                    className="h-4 w-4"
                                    sx={{ color: 'error.main' }}
                                  />
                                  <span>Delete Table</span>
                                </Dropdown.Item>
                              ),
                            ]
                          )}
                        </Dropdown.Content>
                      </Dropdown.Root>
                    }
                  >
                    <ListItem.Button
                      dense
                      selected={isSelected}
                      disabled={tablePath === removableTable}
                      className="group-focus-within:pr-9 group-hover:pr-9 group-active:pr-9"
                      sx={{
                        paddingRight:
                          (isSelected || isSidebarMenuOpen) &&
                          '2.25rem !important',
                      }}
                      component={NavLink}
                      href={`/orgs/${orgSlug}/projects/${appSubdomain}/database/browser/default/${table.table_schema}/${table.table_name}`}
                      onClick={() => {
                        if (onSidebarItemClick) {
                          onSidebarItemClick(`default.${tablePath}`);
                        }
                      }}
                    >
                      <ListItem.Text>{table.table_name}</ListItem.Text>
                    </ListItem.Button>
                  </ListItem.Root>
                );
              })}
            </List>
          )}
        </nav>
      </Box>

      <Box className="border-t">
        <ListItem.Button
          dense
          selected={asPath === sqlEditorHref}
          className="flex border group-focus-within:pr-9 group-hover:pr-9 group-active:pr-9"
          component={NavLink}
          href={sqlEditorHref}
        >
          <div className="flex w-full flex-row items-center justify-center space-x-4">
            <TerminalIcon />
            <span className="flex">SQL Editor</span>
          </div>
        </ListItem.Button>
      </Box>
    </Box>
  );
}

export default function DataBrowserSidebar({
  className,
  onSidebarItemClick,
  ...props
}: DataBrowserSidebarProps) {
  const isPlatform = useIsPlatform();
  const { project } = useProject();

  const [expanded, setExpanded] = useState(false);

  function toggleExpanded() {
    setExpanded(!expanded);
  }

  function handleSidebarItemClick(tablePath?: string) {
    if (onSidebarItemClick && tablePath) {
      onSidebarItemClick(tablePath);
    }

    setExpanded(false);
  }

  function closeSidebarWhenEscapeIsPressed(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      setExpanded(false);
    }
  }

  useEffect(() => {
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
        className="absolute bottom-0 left-0 right-0 top-0 z-[34] sm:hidden"
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

      <Box
        component="aside"
        className={twMerge(
          'absolute top-0 z-[35] h-full w-full overflow-auto border-r-1 pb-17 pt-2 motion-safe:transition-transform sm:relative sm:z-0 sm:h-full sm:pb-0 sm:pt-2.5 sm:transition-none',
          expanded ? 'translate-x-0' : '-translate-x-full sm:translate-x-0',
          className,
        )}
        {...props}
      >
        <RetryableErrorBoundary>
          <DataBrowserSidebarContent
            onSidebarItemClick={handleSidebarItemClick}
          />
        </RetryableErrorBoundary>
      </Box>

      <IconButton
        className="absolute bottom-4 left-4 z-[38] h-11 w-11 rounded-full md:hidden"
        onClick={toggleExpanded}
        aria-label="Toggle sidebar"
      >
        <Image
          width={16}
          height={16}
          src="/assets/table.svg"
          alt="A monochrome table"
        />
      </IconButton>
    </>
  );
}
