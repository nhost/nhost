import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Chip } from '@/components/ui/v2/Chip';
import { Divider } from '@/components/ui/v2/Divider';
import { Dropdown } from '@/components/ui/v2/Dropdown';
import { IconButton } from '@/components/ui/v2/IconButton';
import { DotsVerticalIcon } from '@/components/ui/v2/icons/DotsVerticalIcon';
import { LockIcon } from '@/components/ui/v2/icons/LockIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { List } from '@/components/ui/v2/List';
import { ListItem } from '@/components/ui/v2/ListItem';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { CreateRoleForm } from '@/features/projects/roles/settings/components/CreateRoleForm';
import { EditRoleForm } from '@/features/projects/roles/settings/components/EditRoleForm';
import { getUserRoles } from '@/features/projects/roles/settings/utils/getUserRoles';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import type { Role } from '@/types/application';
import {
  GetRolesPermissionsDocument,
  useGetRolesPermissionsQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { Fragment } from 'react';
import { twMerge } from 'tailwind-merge';

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
  const isPlatform = useIsPlatform();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();
  const { currentProject } = useCurrentWorkspaceAndProject();
  const { openDialog, openAlertDialog } = useDialog();

  const { data, loading, error, refetch } = useGetRolesPermissionsQuery({
    variables: { appId: currentProject?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { allowed: allowedRoles, default: defaultRole } =
    data?.config?.auth?.user?.roles || {};

  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetRolesPermissionsDocument],
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (loading) {
    return <ActivityIndicator delay={1000} label="Loading user roles..." />;
  }

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
        appId: currentProject?.id,
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
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject?.id,
        config: {
          auth: {
            user: {
              roles: {
                allowed: allowedRoles.filter((role) => role !== name),
                default: name === defaultRole ? 'user' : defaultRole,
              },
            },
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
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
        <Text>
          Are you sure you want to delete the allowed role &quot;
          <strong>{originalRole.name}</strong>&quot;?.
        </Text>
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
    <SettingsContainer
      title="Default Allowed Roles"
      description="Default Allowed Roles are roles users get automatically when they sign up."
      docsLink="https://docs.nhost.io/guides/auth/users#allowed-roles"
      rootClassName="gap-0"
      className={twMerge(
        'my-2 px-0',
        availableAllowedRoles.length === 0 && 'gap-2',
      )}
      slotProps={{ submitButton: { className: 'hidden' } }}
    >
      <Box className="border-b-1 px-4 py-3">
        <Text className="font-medium">Name</Text>
      </Box>

      <div className="grid grid-flow-row gap-2">
        {availableAllowedRoles.length > 0 && (
          <List>
            {availableAllowedRoles.map((role, index) => (
              <Fragment key={role.name}>
                <ListItem.Root
                  className="px-4"
                  secondaryAction={
                    <Dropdown.Root>
                      <Dropdown.Trigger
                        asChild
                        hideChevron
                        className="absolute right-4 top-1/2 -translate-y-1/2"
                      >
                        <IconButton
                          variant="borderless"
                          color="secondary"
                          disabled={maintenanceActive}
                        >
                          <DotsVerticalIcon />
                        </IconButton>
                      </Dropdown.Trigger>

                      <Dropdown.Content
                        menu
                        PaperProps={{ className: 'w-32' }}
                        anchorOrigin={{
                          vertical: 'bottom',
                          horizontal: 'right',
                        }}
                        transformOrigin={{
                          vertical: 'top',
                          horizontal: 'right',
                        }}
                      >
                        <Dropdown.Item onClick={() => handleSetAsDefault(role)}>
                          <Text className="font-medium">Set as Default</Text>
                        </Dropdown.Item>

                        <Divider component="li" />

                        <Dropdown.Item
                          disabled={role.isSystemRole}
                          onClick={() => handleOpenEditor(role)}
                        >
                          <Text className="font-medium">Edit</Text>
                        </Dropdown.Item>

                        <Divider component="li" />

                        <Dropdown.Item
                          disabled={role.isSystemRole}
                          onClick={() => handleConfirmDelete(role)}
                        >
                          <Text className="font-medium" color="error">
                            Delete
                          </Text>
                        </Dropdown.Item>
                      </Dropdown.Content>
                    </Dropdown.Root>
                  }
                >
                  <ListItem.Text
                    primaryTypographyProps={{
                      className:
                        'inline-grid grid-flow-col gap-1 items-center h-6 font-medium',
                    }}
                    primary={
                      <>
                        {role.name}

                        {role.isSystemRole && <LockIcon className="h-4 w-4" />}

                        {defaultRole === role.name && (
                          <Chip
                            component="span"
                            color="info"
                            size="small"
                            label="Default"
                          />
                        )}
                      </>
                    }
                  />
                </ListItem.Root>

                <Divider
                  component="li"
                  className={twMerge(
                    index === availableAllowedRoles.length - 1
                      ? '!mt-4'
                      : '!my-4',
                  )}
                />
              </Fragment>
            ))}
          </List>
        )}

        <Button
          className="mx-4 justify-self-start"
          variant="borderless"
          startIcon={<PlusIcon />}
          onClick={handleOpenCreator}
          disabled={maintenanceActive}
        >
          Create Allowed Role
        </Button>
      </div>
    </SettingsContainer>
  );
}
