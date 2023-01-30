import { useDialog } from '@/components/common/DialogProvider';
import SettingsContainer from '@/components/settings/SettingsContainer';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import type { Role } from '@/types/application';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Chip from '@/ui/v2/Chip';
import Divider from '@/ui/v2/Divider';
import { Dropdown } from '@/ui/v2/Dropdown';
import IconButton from '@/ui/v2/IconButton';
import DotsVerticalIcon from '@/ui/v2/icons/DotsVerticalIcon';
import LockIcon from '@/ui/v2/icons/LockIcon';
import PlusIcon from '@/ui/v2/icons/PlusIcon';
import List from '@/ui/v2/List';
import { ListItem } from '@/ui/v2/ListItem';
import Text from '@/ui/v2/Text';
import getUserRoles from '@/utils/settings/getUserRoles';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import {
  useGetRolesQuery,
  useUpdateAppMutation,
} from '@/utils/__generated__/graphql';
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
      getToastStyleProps(),
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
        loading: 'Deleting allowed role...',
        success: 'Allowed Role has been deleted successfully.',
        error: 'An error occurred while trying to delete the allowed role.',
      },
      getToastStyleProps(),
    );
  }

  function handleOpenCreator() {
    openDialog('CREATE_ROLE', {
      title: 'Create Allowed Role',
      props: {
        titleProps: { className: '!pb-0' },
        PaperProps: { className: 'max-w-sm' },
      },
    });
  }

  function handleOpenEditor(originalRole: Role) {
    openDialog('EDIT_ROLE', {
      title: 'Edit Allowed Role',
      payload: { originalRole },
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

  const availableAllowedRoles = getUserRoles(
    data?.app?.authUserDefaultAllowedRoles,
  );

  return (
    <SettingsContainer
      title="Allowed Roles"
      description="Allowed roles are roles users get automatically when they sign up."
      docsLink="https://docs.nhost.io/authentication/users#allowed-roles"
      rootClassName="gap-0"
      className="my-2 px-0"
      slotProps={{ submitButton: { className: 'invisible' } }}
    >
      <Box className="border-b-1 px-4 py-3">
        <Text className="font-medium">Name</Text>
      </Box>

      <div className="grid grid-flow-row gap-2">
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
                  index === availableAllowedRoles.length - 1
                    ? '!mt-4'
                    : '!my-4',
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
          Create Allowed Role
        </Button>
      </div>
    </SettingsContainer>
  );
}
