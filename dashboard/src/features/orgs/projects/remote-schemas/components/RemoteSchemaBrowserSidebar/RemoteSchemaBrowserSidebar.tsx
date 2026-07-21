import { useQueryClient } from '@tanstack/react-query';
import {
  Ellipsis as DotsHorizontalIcon,
  LinkIcon,
  SquarePen as PencilIcon,
  PlusIcon,
  Trash2 as TrashIcon,
  UsersIcon,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { FormActivityIndicator } from '@/components/form/FormActivityIndicator';
import { FeatureSidebar } from '@/components/layout/FeatureSidebar';
import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { Spinner } from '@/components/ui/v3/spinner';
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

const menuItemClassName =
  'flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg';

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
      <Spinner size="xs" wrapperClassName="flex-row gap-1.5 justify-center">
        <span className="text-muted-foreground text-xs">
          Loading remote schemas...
        </span>
      </Spinner>
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
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-col gap-4 px-2">
        <Button
          variant="link"
          className="!text-sm+ flex w-full justify-between px-[0.625rem] text-primary hover:bg-accent hover:no-underline disabled:text-disabled"
          onClick={() => {
            openDrawer({
              title: 'Create a New Remote Schema',
              component: <CreateRemoteSchemaForm onSubmit={refetch} />,
            });
            onSidebarItemClick?.();
          }}
        >
          New Remote Schema
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2">
        {remoteSchemas && remoteSchemas.length === 0 && (
          <p className="px-2 py-1.5 text-disabled text-xs">
            No remote schemas found.
          </p>
        )}
        <nav className="mt-2" aria-label="Remote schema navigation">
          {remoteSchemas.length > 0 && (
            <ul className="w-full max-w-full pb-6">
              {remoteSchemas.map((remoteSchema) => {
                const isSelected = remoteSchemaSlug === remoteSchema.name;
                const isSidebarMenuOpen =
                  sidebarMenuRemoteSchema === remoteSchema.name;
                return (
                  <li className="group pb-1" key={remoteSchema.name}>
                    <Button
                      asChild
                      variant="link"
                      size="sm"
                      className={cn(
                        'flex w-full max-w-full justify-between pl-0 text-sm+ hover:bg-accent hover:no-underline',
                        {
                          'bg-table-selected': isSelected,
                        },
                      )}
                    >
                      <div>
                        <Link
                          href={`/orgs/${orgSlug}/projects/${appSubdomain}/graphql/remote-schemas/${remoteSchema.name}`}
                          onClick={() => {
                            onSidebarItemClick?.(remoteSchema.name);
                          }}
                          className={cn(
                            'flex h-full w-[calc(100%-1.6rem)] items-center p-[0.625rem] pr-0 text-left',
                            {
                              'text-primary-main': isSelected,
                            },
                          )}
                        >
                          <span className="!truncate text-ellipsis">
                            {remoteSchema.name}
                          </span>
                        </Link>
                        <DropdownMenu
                          onOpenChange={(open) =>
                            setSidebarMenuRemoteSchema(
                              open ? remoteSchema.name : undefined,
                            )
                          }
                        >
                          <DropdownMenuTrigger
                            asChild
                            className={cn(
                              'relative z-10 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 group-active:opacity-100',
                              {
                                'opacity-100': isSelected || isSidebarMenuOpen,
                              },
                            )}
                          >
                            <Button
                              variant="outline"
                              size="icon"
                              aria-label="Remote schema options"
                              className="h-6 w-6 border-none bg-transparent px-0 hover:bg-transparent focus-visible:bg-transparent"
                            >
                              <DotsHorizontalIcon />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            side="bottom"
                            align="start"
                            className="w-60 p-0"
                          >
                            <DropdownMenuItem
                              key="edit-table"
                              className={menuItemClassName}
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
                              <PencilIcon className="h-4 w-4" />
                              <span>Edit Remote Schema</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              key="edit-permissions"
                              className={menuItemClassName}
                              onClick={() =>
                                handleEditPermissionClick(remoteSchema.name)
                              }
                            >
                              <UsersIcon className="h-4 w-4" />
                              <span>Edit Permissions</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              key="edit-relationships"
                              className={menuItemClassName}
                              onClick={() =>
                                handleEditRelationshipsClick(remoteSchema.name)
                              }
                            >
                              <LinkIcon className="h-4 w-4" />
                              <span>Edit Relationships</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              key="delete-remote-schema"
                              className={cn(
                                menuItemClassName,
                                '!text-destructive',
                              )}
                              onClick={() =>
                                handleDeleteRemoteSchemaClick(remoteSchema)
                              }
                            >
                              <TrashIcon className="h-4 w-4" />
                              <span>Delete Remote Schema</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>
      </div>
    </div>
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
    <FeatureSidebar toggleOffset="left-8" className={cn('box', className)}>
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
