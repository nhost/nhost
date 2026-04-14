import { useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { ListNavLink } from '@/components/common/NavLink';
import { FormActivityIndicator } from '@/components/form/FormActivityIndicator';
import { FeatureSidebar } from '@/components/layout/FeatureSidebar';
import { InlineCode } from '@/components/presentational/InlineCode';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
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
import useGetRemoteSchemas from '@/features/orgs/projects/remote-schemas/hooks/useGetRemoteSchemas/useGetRemoteSchemas';
import { useRemoveRemoteSchemaMutation } from '@/features/orgs/projects/remote-schemas/hooks/useRemoveRemoteSchemaMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { cn } from '@/lib/utils';
import type { RemoteSchemaInfo } from '@/utils/hasura-api/generated/schemas';

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

const EditRemoteSchemaRelationships = dynamic(
  () =>
    import(
      '@/features/orgs/projects/remote-schemas/components/EditRemoteSchemaRelationships/EditRemoteSchemaRelationships'
    ),
  {
    ssr: false,
  },
);

export interface RemoteSchemaBrowserSidebarProps {
  className?: string;
  onSidebarItemClick?: (remoteSchemaName?: string) => void;
}

function RemoteSchemaBrowserSidebarContent({
  onSidebarItemClick,
}: Pick<RemoteSchemaBrowserSidebarProps, 'onSidebarItemClick'>) {
  const queryClient = useQueryClient();
  const { openDrawer, openAlertDialog } = useDialog();
  const { project } = useProject();

  const router = useRouter();

  const {
    query: { orgSlug, appSubdomain, remoteSchemaSlug },
  } = router;

  const { data: remoteSchemas, status, refetch, error } = useGetRemoteSchemas();

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
    throw error instanceof Error
      ? error
      : new Error('Unknown error occurred. Please try again later.');
  }

  const handleDeleteRemoteSchema = async (schema: RemoteSchemaInfo) => {
    await execPromiseWithErrorToast(
      async () => {
        await deleteRemoteSchema({
          remoteSchema: schema,
        });
        refetch();
      },
      {
        loadingMessage: 'Deleting remote schema...',
        successMessage: 'Remote schema deleted successfully.',
        errorMessage: 'Failed to delete remote schema',
      },
    );
  };

  function handleDeleteRemoteSchemaClick(schema: RemoteSchemaInfo) {
    openAlertDialog({
      title: 'Delete Remote Schema',
      payload: (
        <span>
          Are you sure you want to delete the{' '}
          <strong className="break-all">{schema.name}</strong> remote schema?
        </span>
      ),
      props: {
        primaryButtonText: 'Delete',
        primaryButtonColor: 'error',
        onPrimaryAction: () => handleDeleteRemoteSchema(schema),
      },
    });
  }

  function handleEditPermissionClick(schema: string) {
    openDrawer({
      title: (
        <span className="inline-grid grid-flow-col items-center gap-2">
          Permissions
          <InlineCode className="!text-sm+ font-normal">{schema}</InlineCode>
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

  function handleEditRelationshipsClick(schema: string) {
    openDrawer({
      title: (
        <span className="inline-grid grid-flow-col items-center gap-2">
          Relationships
          <InlineCode className="!text-sm+ font-normal">{schema}</InlineCode>
        </span>
      ),
      component: <EditRemoteSchemaRelationships schema={schema} />,
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
          onSidebarItemClick?.();
        }}
      >
        New Remote Schema
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
                      id="remote-schema-management-menu"
                      onOpen={() =>
                        setSidebarMenuRemoteSchema(remoteSchema.name)
                      }
                      onClose={() => setSidebarMenuRemoteSchema(undefined)}
                    >
                      <Dropdown.Trigger asChild hideChevron>
                        <IconButton
                          variant="borderless"
                          color={isSelected ? 'primary' : 'secondary'}
                          className={cn(
                            !isSelected &&
                              'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 group-active:opacity-100',
                          )}
                        >
                          <DotsHorizontalIcon />
                        </IconButton>
                      </Dropdown.Trigger>
                      <Dropdown.Content menu PaperProps={{ className: 'w-52' }}>
                        <Dropdown.Item
                          key="edit-table"
                          className="grid grid-flow-col items-center gap-2 p-2 font-medium text-sm+"
                          onClick={() =>
                            openDrawer({
                              title: 'Edit Remote Schema',
                              component: (
                                <EditRemoteSchemaForm
                                  originalSchema={remoteSchema}
                                  onSubmit={async () => {
                                    await queryClient.refetchQueries({
                                      queryKey: [
                                        `remote_schemas`,
                                        project?.subdomain,
                                      ],
                                    });
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
                        <Divider component="li" />
                        <Dropdown.Item
                          key="edit-permissions"
                          className="grid grid-flow-col items-center gap-2 p-2 font-medium text-sm+"
                          onClick={() =>
                            handleEditPermissionClick(remoteSchema.name)
                          }
                        >
                          <UsersIcon
                            className="h-4 w-4"
                            sx={{ color: 'text.secondary' }}
                          />
                          <span>Edit Permissions</span>
                        </Dropdown.Item>
                        <Divider component="li" />
                        <Dropdown.Item
                          key="edit-relationships"
                          className="grid grid-flow-col items-center gap-2 p-2 font-medium text-sm+"
                          onClick={() =>
                            handleEditRelationshipsClick(remoteSchema.name)
                          }
                        >
                          <LinkIcon
                            className="h-4 w-4"
                            sx={{ color: 'text.secondary' }}
                          />
                          <span>Edit Relationships</span>
                        </Dropdown.Item>
                        <Divider component="li" />
                        <Dropdown.Item
                          key="delete-remote-schema"
                          className="grid grid-flow-col items-center gap-2 p-2 font-medium text-sm+"
                          sx={{ color: 'error.main' }}
                          onClick={() =>
                            handleDeleteRemoteSchemaClick(remoteSchema)
                          }
                        >
                          <TrashIcon
                            className="h-4 w-4"
                            sx={{ color: 'error.main' }}
                          />
                          <span>Delete Remote Schema</span>
                        </Dropdown.Item>
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
                    component={ListNavLink}
                    href={`/orgs/${orgSlug}/projects/${appSubdomain}/graphql/remote-schemas/${remoteSchema.name}`}
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
}: RemoteSchemaBrowserSidebarProps) {
  const isPlatform = useIsPlatform();
  const { project } = useProject();

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return null;
  }

  return (
    <FeatureSidebar toggleOffset="left-8" className={className}>
      {(collapse) => (
        <RemoteSchemaBrowserSidebarContent
          onSidebarItemClick={(remoteSchemaName) => {
            if (onSidebarItemClick && remoteSchemaName) {
              onSidebarItemClick(remoteSchemaName);
            }
            collapse();
          }}
        />
      )}
    </FeatureSidebar>
  );
}
