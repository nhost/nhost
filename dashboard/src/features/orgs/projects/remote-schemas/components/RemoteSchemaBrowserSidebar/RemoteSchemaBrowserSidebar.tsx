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
import { LinkIcon } from '@/components/ui/v2/icons/LinkIcon';
import { PencilIcon } from '@/components/ui/v2/icons/PencilIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { UsersIcon } from '@/components/ui/v2/icons/UsersIcon';
import { List } from '@/components/ui/v2/List';
import { ListItem } from '@/components/ui/v2/ListItem';
import { Text } from '@/components/ui/v2/Text';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import useGetRemoteSchemasQuery from '@/features/orgs/projects/remote-schemas/hooks/useGetRemoteSchemasQuery/useGetRemoteSchemasQuery';
import { useRemoveRemoteSchemaMutation } from '@/features/orgs/projects/remote-schemas/hooks/useRemoveRemoteSchemaMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { twMerge } from 'tailwind-merge';

const CreateRemoteSchemaForm = dynamic(
  () =>
    import(
      '@/features/orgs/projects/remote-schemas/components/CreateRemoteSchemaForm/CreateRemoteSchemaForm'
    ),
  {
    ssr: false,
    loading: () => <FormActivityIndicator />,
  },
);

const EditRemoteSchemaForm = dynamic(
  () =>
    import(
      '@/features/orgs/projects/remote-schemas/components/EditRemoteSchemaForm/EditRemoteSchemaForm'
    ),
  {
    ssr: false,
    loading: () => <FormActivityIndicator />,
  },
);

const EditRemoteSchemaPermissionsForm = dynamic(
  () =>
    import(
      '@/features/orgs/projects/remote-schemas/components/EditRemoteSchemaPermissionsForm/EditRemoteSchemaPermissionsForm'
    ),
  {
    ssr: false,
    loading: () => <FormActivityIndicator />,
  },
);

export interface RemoteSchemaBrowserSidebarProps
  extends Omit<BoxProps, 'children'> {
  /**
   * Function to be called when a sidebar item is clicked.
   */
  onSidebarItemClick?: (tablePath?: string) => void;
}

function RemoteSchemaBrowserSidebarContent({
  onSidebarItemClick,
}: Pick<RemoteSchemaBrowserSidebarProps, 'onSidebarItemClick'>) {
  const queryClient = useQueryClient();
  const { openDrawer, openAlertDialog } = useDialog();
  const { project } = useProject();
  const isGitHubConnected = !!project?.githubRepository;

  const router = useRouter();

  const {
    query: { orgSlug, appSubdomain, remoteSchemaSlug },
  } = router;

  const {
    data: remoteSchemas,
    status,
    refetch,
    error,
  } = useGetRemoteSchemasQuery([`remote_schemas`, project?.subdomain]);

  const { mutateAsync: deleteRemoteSchema } = useRemoveRemoteSchemaMutation();

  const [sidebarMenuRemoteSchema, setSidebarMenuRemoteSchema] =
    useState<string>();

  if (status === 'loading') {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading remote schemas..."
        className="justify-center"
      />
    );
  }

  if (status === 'error') {
    throw error || new Error('Unknown error occurred. Please try again later.');
  }

  const handleDeleteRemoteSchema = async (schema: string) => {
    await execPromiseWithErrorToast(
      async () => {
        await deleteRemoteSchema({
          args: {
            name: schema,
          },
        });
      },
      {
        loadingMessage: 'Deleting remote schema...',
        successMessage: 'Remote schema deleted successfully!',
        errorMessage: 'Failed to delete remote schema',
      },
    );
  };

  function handleDeleteRemoteSchemaClick(schema: string) {
    openAlertDialog({
      title: 'Delete Remote Schema',
      payload: (
        <span>
          Are you sure you want to delete the{' '}
          <strong className="break-all">{schema}</strong> remote schema?
        </span>
      ),
      props: {
        primaryButtonText: 'Delete',
        primaryButtonColor: 'error',
        onPrimaryAction: () => handleDeleteRemoteSchema(schema),
      },
    });
  }

  function handleEditPermissionClick(schema: string, table: string) {
    openDrawer({
      title: (
        <span className="inline-grid grid-flow-col items-center gap-2">
          Permissions
          <InlineCode className="!text-sm+ font-normal">{table}</InlineCode>
          <Chip label="Preview" size="small" color="info" component="span" />
        </span>
      ),
      component: <EditRemoteSchemaPermissionsForm schema={schema} />,
      props: {
        PaperProps: {
          className: 'lg:w-[65%] lg:max-w-7xl',
        },
      },
    });
  }

  return (
    <Box className="flex h-full flex-col px-2">
      <Button
        variant="borderless"
        endIcon={<PlusIcon />}
        className="mt-1 w-full justify-between px-2"
        onClick={() => {
          openDrawer({
            title: 'Create a New Remote Schema',
            component: <CreateRemoteSchemaForm onSubmit={refetch} />,
          });
          onSidebarItemClick();
        }}
        disabled={isGitHubConnected}
      >
        Add Remote Schema
      </Button>
      {remoteSchemas && remoteSchemas.length === 0 && (
        <Text className="px-2 py-1.5 text-xs" color="disabled">
          No remote schemas found.
        </Text>
      )}
      <nav aria-label="Database navigation">
        {remoteSchemas.length > 0 && (
          <List className="grid gap-1 pb-6">
            {remoteSchemas.map((remoteSchema) => {
              const isSelected = remoteSchemaSlug === remoteSchema.name;
              const isSidebarMenuOpen =
                sidebarMenuRemoteSchema === remoteSchema.name;
              return (
                <ListItem.Root
                  className="group"
                  key={remoteSchema.name}
                  secondaryAction={
                    <Dropdown.Root
                      id="table-management-menu"
                      onOpen={() =>
                        setSidebarMenuRemoteSchema(remoteSchema.name)
                      }
                      onClose={() => setSidebarMenuRemoteSchema(undefined)}
                    >
                      <Dropdown.Trigger asChild hideChevron>
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
                      <Dropdown.Content menu PaperProps={{ className: 'w-52' }}>
                        {isGitHubConnected ? (
                          <Dropdown.Item
                            className="grid grid-flow-col items-center gap-2 p-2 text-sm+ font-medium"
                            onClick={() =>
                              handleEditPermissionClick(
                                remoteSchema.name,
                                remoteSchema.name,
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
                          <>
                            <Dropdown.Item
                              key="edit-table"
                              className="grid grid-flow-col items-center gap-2 p-2 text-sm+ font-medium"
                              onClick={() =>
                                openDrawer({
                                  title: 'Edit Table',
                                  component: (
                                    <EditRemoteSchemaForm
                                      originalSchema={remoteSchema}
                                      onSubmit={async () => {
                                        await queryClient.refetchQueries([
                                          `remote_schemas`,
                                          project?.subdomain,
                                        ]);
                                        await refetch();
                                      }}
                                    />
                                  ),
                                })
                              }
                            >
                              <PencilIcon
                                className="h-4 w-4"
                                sx={{ color: 'text.secondary' }}
                              />
                              <span>Edit Remote Schema</span>
                            </Dropdown.Item>
                            <Divider
                              key="edit-table-separator"
                              component="li"
                            />
                            <Dropdown.Item
                              key="edit-permissions"
                              className="grid grid-flow-col items-center gap-2 p-2 text-sm+ font-medium"
                              onClick={() =>
                                handleEditPermissionClick(
                                  remoteSchema.name,
                                  remoteSchema.name,
                                )
                              }
                            >
                              <UsersIcon
                                className="h-4 w-4"
                                sx={{ color: 'text.secondary' }}
                              />
                              <span>Edit Permissions</span>
                            </Dropdown.Item>
                            <Divider
                              key="edit-permissions-separator"
                              component="li"
                            />
                            <Dropdown.Item
                              key="edit-relationships"
                              className="grid grid-flow-col items-center gap-2 p-2 text-sm+ font-medium"
                              onClick={() =>
                                handleEditPermissionClick(
                                  remoteSchema.name,
                                  remoteSchema.name,
                                )
                              }
                            >
                              <LinkIcon
                                className="h-4 w-4"
                                sx={{ color: 'text.secondary' }}
                              />
                              <span>Edit Relationships</span>
                            </Dropdown.Item>
                            <Divider
                              key="edit-relationships-separator"
                              component="li"
                            />
                            <Dropdown.Item
                              key="delete-remote-schema"
                              className="grid grid-flow-col items-center gap-2 p-2 text-sm+ font-medium"
                              sx={{ color: 'error.main' }}
                              onClick={() =>
                                handleDeleteRemoteSchemaClick(remoteSchema.name)
                              }
                            >
                              <TrashIcon
                                className="h-4 w-4"
                                sx={{ color: 'error.main' }}
                              />
                              <span>Delete Remote Schema</span>
                            </Dropdown.Item>
                          </>
                        )}
                      </Dropdown.Content>
                    </Dropdown.Root>
                  }
                >
                  <ListItem.Button
                    dense
                    selected={isSelected}
                    className="group-focus-within:pr-9 group-hover:pr-9 group-active:pr-9"
                    sx={{
                      paddingRight:
                        (isSelected || isSidebarMenuOpen) &&
                        '2.25rem !important',
                    }}
                    component={NavLink}
                    href={`/orgs/${orgSlug}/projects/${appSubdomain}/settings/remote-schemas/${remoteSchema.name}`}
                    onClick={() => {
                      if (onSidebarItemClick) {
                        onSidebarItemClick(`${remoteSchema.name}`);
                      }
                    }}
                  >
                    <ListItem.Text>{remoteSchema.name}</ListItem.Text>
                  </ListItem.Button>
                </ListItem.Root>
              );
            })}
          </List>
        )}
      </nav>
    </Box>
  );
}

export default function RemoteSchemaBrowserSidebar({
  className,
  onSidebarItemClick,
  ...props
}: RemoteSchemaBrowserSidebarProps) {
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
          <RemoteSchemaBrowserSidebarContent
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
