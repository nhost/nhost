import { useDialog } from '@/components/common/DialogProvider';
import SettingsContainer from '@/components/settings/SettingsContainer';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import type { Role } from '@/types/application';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Button from '@/ui/v2/Button';
import Chip from '@/ui/v2/Chip';
import Divider from '@/ui/v2/Divider';
import { Dropdown } from '@/ui/v2/Dropdown';
import IconButton from '@/ui/v2/IconButton';
import List from '@/ui/v2/List';
import { ListItem } from '@/ui/v2/ListItem';
import Text from '@/ui/v2/Text';
import DotsVerticalIcon from '@/ui/v2/icons/DotsVerticalIcon';
import LockIcon from '@/ui/v2/icons/LockIcon';
import PlusIcon from '@/ui/v2/icons/PlusIcon';
import {
  useGetRolesQuery,
  useUpdateAppMutation
} from '@/utils/__generated__/graphql';
import getUserRoles from '@/utils/settings/getUserRoles';
import { toastStyleProps } from '@/utils/settings/settingsConstants';
import { Fragment } from 'react';
import toast from 'react-hot-toast';
import { twMerge } from 'tailwind-merge';

export interface RoleSettingsFormValues {
  /**
   * Default role.
   */
  authUserDefaultRole: string;
  /**
   * Allowed roles for the project.
   */
  authUserDefaultAllowedRoles: Role[];
}

export default function RoleSettings() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const { openDialog, openAlertDialog } = useDialog();

  const { data, loading, error } = useGetRolesQuery({
    variables: { id: currentApplication?.id },
  });

  const [updateApp] = useUpdateAppMutation({
    refetchQueries: ['getRoles'],
  });

  if (loading) {
    return <ActivityIndicator delay={1000} label="Loading user roles..." />;
  }

  if (error) {
    throw error;
  }

  async function handleSetAsDefault({ name }: Role) {
    const updateAppPromise = updateApp({
      variables: {
        id: currentApplication?.id,
        app: {
          authUserDefaultRole: name,
        },
      },
    });

    await toast.promise(
      updateAppPromise,
      {
        loading: 'Updating default role...',
        success: 'Default role has been updated successfully.',
        error: 'An error occurred while trying to update the default role.',
      },
      toastStyleProps,
    );
  }

  async function handleDeleteRole({ name }: Role) {
    const filteredRoles = data?.app?.authUserDefaultAllowedRoles
      .split(',')
      .filter((role) => role !== name)
      .join(',');

    const updateAppPromise = updateApp({
      variables: {
        id: currentApplication?.id,
        app: {
          authUserDefaultAllowedRoles: filteredRoles,
          authUserDefaultRole:
            name === data?.app?.authUserDefaultRole
              ? 'user'
              : data?.app?.authUserDefaultRole,
        },
      },
    });

    await toast.promise(
      updateAppPromise,
      {
        loading: 'Deleting role...',
        success: 'Role has been deleted successfully.',
        error: 'An error occurred while trying to delete the role.',
      },
      toastStyleProps,
    );
  }

  function handleOpenCreator() {
    openDialog('CREATE_ROLE', {
      title: 'Create Role',
      props: {
        titleProps: { className: '!pb-0' },
        PaperProps: { className: 'max-w-sm' },
      },
    });
  }

  function handleOpenEditor(originalRole: Role) {
    openDialog('EDIT_ROLE', {
      title: 'Edit Role',
      payload: { originalRole },
      props: {
        titleProps: { className: '!pb-0' },
        PaperProps: { className: 'max-w-sm' },
      },
    });
  }

  function handleConfirmDelete(originalRole: Role) {
    openAlertDialog({
      title: 'Delete Role',
      payload: (
        <Text>
          Are you sure you want to delete the &quot;
          <strong>{originalRole.name}</strong>&quot; role? This cannot be
          undone.
        </Text>
      ),
      props: {
        onPrimaryAction: () => handleDeleteRole(originalRole),
        primaryButtonColor: 'error',
        primaryButtonText: 'Delete',
      },
    });
  }

  const availableRoles = getUserRoles(data?.app?.authUserDefaultAllowedRoles);

  return (
    <SettingsContainer
      title="Roles"
      description="Roles are used to control access to your application."
      docsLink="https://docs.nhost.io/authentication/users#roles"
      rootClassName="gap-0"
      className="px-0 my-2"
      slotProps={{ submitButton: { className: 'invisible' } }}
    >
      <div className="px-4 py-3 border-gray-200 border-b-1">
        <Text className="font-medium">Name</Text>
      </div>

      <div className="grid grid-flow-row gap-2">
        <List>
          {availableRoles.map((role, index) => (
            <Fragment key={role.name}>
              <ListItem.Root
                className="px-4"
                secondaryAction={
                  <Dropdown.Root>
                    <Dropdown.Trigger
                      asChild
                      hideChevron
                      className="absolute -translate-y-1/2 right-4 top-1/2"
                    >
                      <IconButton variant="borderless" color="secondary">
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
                        <Text
                          className="font-medium"
                          sx={{
                            color: (theme) => theme.palette.error.main,
                          }}
                        >
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

                      {role.isSystemRole && <LockIcon className="w-4 h-4" />}

                      {data?.app?.authUserDefaultRole === role.name && (
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
                  index === availableRoles.length - 1 ? '!mt-4' : '!my-4',
                )}
              />
            </Fragment>
          ))}
        </List>

        <Button
          className="mx-4 justify-self-start"
          variant="borderless"
          startIcon={<PlusIcon />}
          onClick={handleOpenCreator}
        >
          Create Role
        </Button>
      </div>
    </SettingsContainer>
  );
}
