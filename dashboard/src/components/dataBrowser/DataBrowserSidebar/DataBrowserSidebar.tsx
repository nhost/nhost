import { useDialog } from '@/components/common/DialogProvider';
import InlineCode from '@/components/common/InlineCode';
import NavLink from '@/components/common/NavLink';
import RetryableErrorBoundary from '@/components/common/RetryableErrorBoundary';
import useIsPlatform from '@/hooks/common/useIsPlatform';
import useDatabaseQuery from '@/hooks/dataBrowser/useDatabaseQuery';
import useDeleteTableWithToastMutation from '@/hooks/dataBrowser/useDeleteTableMutation/useDeleteTableWithToastMutation';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import FloatingActionButton from '@/ui/FloatingActionButton';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Backdrop from '@/ui/v2/Backdrop';
import type { BoxProps } from '@/ui/v2/Box';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Chip from '@/ui/v2/Chip';
import Divider from '@/ui/v2/Divider';
import { Dropdown } from '@/ui/v2/Dropdown';
import IconButton from '@/ui/v2/IconButton';
import ArrowRightIcon from '@/ui/v2/icons/ArrowRightIcon';
import DotsHorizontalIcon from '@/ui/v2/icons/DotsHorizontalIcon';
import LockIcon from '@/ui/v2/icons/LockIcon';
import PencilIcon from '@/ui/v2/icons/PencilIcon';
import PlusIcon from '@/ui/v2/icons/PlusIcon';
import TrashIcon from '@/ui/v2/icons/TrashIcon';
import UsersIcon from '@/ui/v2/icons/UsersIcon';
import Link from '@/ui/v2/Link';
import List from '@/ui/v2/List';
import { ListItem } from '@/ui/v2/ListItem';
import Option from '@/ui/v2/Option';
import Select from '@/ui/v2/Select';
import Text from '@/ui/v2/Text';
import { isSchemaLocked } from '@/utils/dataBrowser/schemaHelpers';
import { useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { twMerge } from 'tailwind-merge';

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
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const isGitHubConnected = !!currentApplication?.githubRepository;

  const router = useRouter();
  const {
    query: { workspaceSlug, appSlug, dataSourceSlug, schemaSlug, tableSlug },
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
          `/${workspaceSlug}/${appSlug}/database/browser/${dataSourceSlug}`,
        );

        return;
      }

      if (schema === schemaSlug && table === tableSlug) {
        await router.push(
          `/${workspaceSlug}/${appSlug}/database/browser/${dataSourceSlug}/${nextTable.table_schema}/${nextTable.table_name}`,
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
    openDrawer('EDIT_PERMISSIONS', {
      title: (
        <span className="inline-grid grid-flow-col items-center gap-2">
          Permissions
          <InlineCode className="!text-sm+ font-normal">{table}</InlineCode>
          <Chip label="Preview" size="small" color="info" component="span" />
        </span>
      ),
      props: {
        PaperProps: {
          className: 'lg:w-[65%] lg:max-w-7xl',
        },
      },
      payload: {
        onSubmit: async () => {
          await queryClient.refetchQueries([
            `${dataSourceSlug}.${schema}.${table}`,
          ]);
          await refetch();
        },
        disabled,
        schema,
        table,
      },
    });
  }

  return (
    <div className="grid gap-1">
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

          <Link
            href="https://docs.nhost.io/platform/github-integration"
            target="_blank"
            rel="noopener noreferrer"
            underline="hover"
            className="grid grid-flow-col items-center justify-start gap-1"
          >
            Learn More <ArrowRightIcon />
          </Link>
        </Box>
      )}

      {!isSelectedSchemaLocked && (
        <Button
          variant="borderless"
          endIcon={<PlusIcon />}
          className="mt-1 w-full justify-between px-2"
          onClick={() => {
            openDrawer('CREATE_TABLE', {
              title: 'Create a New Table',
              payload: { onSubmit: refetch, schema: selectedSchema },
            });

            onSidebarItemClick();
          }}
          disabled={isGitHubConnected}
        >
          New Table
        </Button>
      )}

      {schemas && schemas.length > 0 && tablesInSelectedSchema.length === 0 && (
        <Text className="py-1.5 px-2 text-xs" color="disabled">
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
                    !isSelectedSchemaLocked && (
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
                              <Dropdown.Item
                                key="edit-table"
                                className="grid grid-flow-col items-center gap-2 p-2 text-sm+ font-medium"
                                onClick={() =>
                                  openDrawer('EDIT_TABLE', {
                                    title: 'Edit Table',
                                    payload: {
                                      onSubmit: async () => {
                                        await queryClient.refetchQueries([
                                          `${dataSourceSlug}.${table.table_schema}.${table.table_name}`,
                                        ]);
                                        await refetch();
                                      },
                                      schema: table.table_schema,
                                      table,
                                    },
                                  })
                                }
                              >
                                <PencilIcon
                                  className="h-4 w-4"
                                  sx={{ color: 'text.secondary' }}
                                />

                                <span>Edit Table</span>
                              </Dropdown.Item>,
                              <Divider
                                key="edit-table-separator"
                                component="li"
                              />,
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
                              <Divider
                                key="edit-permissions-separator"
                                component="li"
                              />,
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
                              </Dropdown.Item>,
                            ]
                          )}
                        </Dropdown.Content>
                      </Dropdown.Root>
                    )
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
                    href={`/${workspaceSlug}/${appSlug}/database/browser/default/${table.table_schema}/${table.table_name}`}
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
    </div>
  );
}

export default function DataBrowserSidebar({
  className,
  onSidebarItemClick,
  ...props
}: DataBrowserSidebarProps) {
  const isPlatform = useIsPlatform();
  const { currentApplication } = useCurrentWorkspaceAndApplication();

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

  if (isPlatform && !currentApplication?.hasuraGraphqlAdminSecret) {
    return null;
  }

  return (
    <>
      <Backdrop
        open={expanded}
        className="absolute top-0 left-0 bottom-0 right-0 z-[34] sm:hidden"
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
          'absolute top-0 z-[35] h-full w-full overflow-auto border-r-1 px-2 pt-2 pb-17 motion-safe:transition-transform sm:relative sm:z-0 sm:h-full sm:py-2.5 sm:transition-none',
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

      <FloatingActionButton
        className="absolute bottom-4 left-4 z-[38] sm:hidden"
        onClick={toggleExpanded}
        aria-label="Toggle sidebar"
      >
        <Image
          width={16}
          height={16}
          src="/assets/table.svg"
          alt="A monochrome table"
        />
      </FloatingActionButton>
    </>
  );
}
