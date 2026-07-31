import {
  EllipsisVertical as DotsVerticalIcon,
  LockIcon,
  PlusIcon,
} from 'lucide-react';
import { Fragment } from 'react';
import { twMerge } from 'tailwind-merge';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
  SettingsDocsLink,
} from '@/components/layout/SettingsCard';
import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { CreateRoleForm } from '@/features/orgs/projects/roles/settings/components/CreateRoleForm';
import { EditRoleForm } from '@/features/orgs/projects/roles/settings/components/EditRoleForm';
import { getUserRoles } from '@/features/orgs/projects/roles/settings/utils/getUserRoles';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useGetRolesPermissionsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import type { Role } from '@/types/application';

export interface RoleSettingsFormValues {
  /**
   * Default role.
   */
  authUserDefaultRole: string;
  /**
   * Default Allowed roles for the project.
   */
  authUserDefaultAllowedRoles: Role[];
}

export default function RoleSettings() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { openDialog, openAlertDialog } = useDialog();

  const { data, error, refetch } = useGetRolesPermissionsQuery({
    variables: { appId: project?.id },
    fetchPolicy: 'cache-and-network',
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { allowed: allowedRoles, default: defaultRole } =
    data?.config?.auth?.user?.roles || {};

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (error) {
    throw error;
  }

  async function showApplyChangesDialog() {
    if (!isPlatform) {
      openDialog({
        title: 'Apply your changes',
        component: <ApplyLocalSettingsDialog />,
        props: {
          PaperProps: {
            className: 'max-w-2xl',
          },
        },
      });
    }
  }

  async function handleSetAsDefault({ name }: Role) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project?.id,
        config: {
          auth: {
            user: {
              roles: {
                allowed: allowedRoles,
                default: name,
              },
            },
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        await refetch();
        showApplyChangesDialog();
      },
      {
        loadingMessage: 'Updating default role...',
        successMessage: 'Default role has been updated successfully.',
        errorMessage:
          'An error occurred while trying to update the default role.',
      },
    );
  }

  async function handleDeleteRole({ name }: Role) {
    await execPromiseWithErrorToast(
      async () => {
        await updateConfig({
          variables: {
            appId: project?.id,
            config: {
              auth: {
                user: {
                  roles: {
                    allowed: (allowedRoles ?? []).filter(
                      (role) => role !== name,
                    ),
                    default: name === defaultRole ? 'user' : defaultRole,
                  },
                },
              },
            },
          },
        });

        await refetch();
        showApplyChangesDialog();
      },
      {
        loadingMessage: 'Deleting allowed role...',
        successMessage: 'Allowed Role has been deleted successfully.',
        errorMessage:
          'An error occurred while trying to delete the allowed role.',
      },
    );
  }

  function handleOpenCreator() {
    openDialog({
      title: 'Create Allowed Role',
      component: <CreateRoleForm onSubmit={refetch} />,
      props: {
        titleProps: { className: '!pb-0' },
        PaperProps: { className: 'max-w-sm' },
      },
    });
  }

  function handleOpenEditor(originalRole: Role) {
    openDialog({
      title: 'Edit Allowed Role',
      component: (
        <EditRoleForm originalRole={originalRole} onSubmit={refetch} />
      ),
      props: {
        titleProps: { className: '!pb-0' },
        PaperProps: { className: 'max-w-sm' },
      },
    });
  }

  function handleConfirmDelete(originalRole: Role) {
    openAlertDialog({
      title: 'Delete Allowed Role',
      payload: (
        <p>
          Are you sure you want to delete the allowed role &quot;
          <strong>{originalRole.name}</strong>&quot;?.
        </p>
      ),
      props: {
        onPrimaryAction: () => handleDeleteRole(originalRole),
        primaryButtonColor: 'error',
        primaryButtonText: 'Delete',
      },
    });
  }

  const availableAllowedRoles = getUserRoles(allowedRoles);

  return (
    <SettingsCard className="gap-0">
      <SettingsCardHeader
        title="Default Allowed Roles"
        description="Default Allowed Roles are roles users get automatically when they sign up."
      />

      <SettingsCardContent
        className={twMerge(
          'my-2 px-0',
          availableAllowedRoles.length === 0 && 'gap-2',
        )}
      >
        <div className="border-b-1 px-4 py-3">
          <p className="font-medium">Name</p>
        </div>

        <div className="grid grid-flow-row gap-2">
          {availableAllowedRoles.length > 0 && (
            <div>
              {availableAllowedRoles.map((role, index) => (
                <Fragment key={role.name}>
                  <div className="relative px-4 pr-12">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute top-1/2 right-4 -translate-y-1/2"
                        >
                          <DotsVerticalIcon className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end" className="w-32 p-0">
                        <DropdownMenuItem
                          onClick={() => handleSetAsDefault(role)}
                          className="flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
                        >
                          <span>Set as Default</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          disabled={role.isSystemRole}
                          onClick={() => handleOpenEditor(role)}
                          className="flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
                        >
                          <span>Edit</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          disabled={role.isSystemRole}
                          onClick={() => handleConfirmDelete(role)}
                          className="!text-destructive flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
                        >
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <p className="inline-grid h-6 grid-flow-col items-center gap-1 font-medium">
                      {role.name}

                      {role.isSystemRole && <LockIcon className="h-4 w-4" />}

                      {defaultRole === role.name && (
                        <Badge variant="secondary">Default</Badge>
                      )}
                    </p>
                  </div>

                  <div
                    className={twMerge(
                      'border-t',
                      index === availableAllowedRoles.length - 1
                        ? '!mt-4'
                        : '!my-4',
                    )}
                  />
                </Fragment>
              ))}
            </div>
          )}

          <Button
            type="button"
            variant="ghost"
            className="mx-4 justify-self-start text-primary-main hover:bg-primary-highlight hover:text-primary-main"
            onClick={handleOpenCreator}
          >
            <PlusIcon className="mr-2 h-4 w-4" />
            Create Allowed Role
          </Button>
        </div>
      </SettingsCardContent>

      <SettingsCardFooter>
        <SettingsDocsLink
          href="https://docs.nhost.io/products/auth/users#allowed-roles"
          title="Default Allowed Roles"
        />
      </SettingsCardFooter>
    </SettingsCard>
  );
}
