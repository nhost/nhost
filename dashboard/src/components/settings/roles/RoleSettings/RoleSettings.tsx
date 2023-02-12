import { useDialog } from '@/components/common/DialogProvider';
import SettingsContainer from '@/components/settings/SettingsContainer';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { useRemoteApplicationGQLClient } from '@/hooks/useRemoteApplicationGQLClient';
import type { Role } from '@/types/application';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Divider from '@/ui/v2/Divider';
import { Dropdown } from '@/ui/v2/Dropdown';
import IconButton from '@/ui/v2/IconButton';
import DotsVerticalIcon from '@/ui/v2/icons/DotsVerticalIcon';
import LockIcon from '@/ui/v2/icons/LockIcon';
import PlusIcon from '@/ui/v2/icons/PlusIcon';
import List from '@/ui/v2/List';
import { ListItem } from '@/ui/v2/ListItem';
import Text from '@/ui/v2/Text';
import { SYSTEM_ROLES } from '@/utils/CONSTANTS';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import {
  useDeleteRemoteAppRoleMutation,
  useGetRemoteAppRolesQuery,
  useGetRolesLazyQuery,
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

  // get the remote app gql client
  const remoteProjectGqlClient = useRemoteApplicationGQLClient();

  // get roles from the remote app
  const {
    data: rolesData,
    loading: rolesLoading,
    error: rolesError,
    refetch: refetchRoles,
  } = useGetRemoteAppRolesQuery({
    client: remoteProjectGqlClient,
  });

  // delete role mutation
  const [deleteRemoteAppRole] = useDeleteRemoteAppRoleMutation({
    client: remoteProjectGqlClient,
    refetchQueries: ['getRemoteAppRoles'],
  });

  const [getAppRoles] = useGetRolesLazyQuery();

  if (rolesLoading) {
    return <ActivityIndicator delay={1000} label="Loading user roles..." />;
  }

  if (rolesError) {
    throw rolesError;
  }

  async function handleDeleteRole({ name }: Role) {
    // get project (app) roles settings to check if the role is
    // the default role or a default allowed role.
    // If that's the case, we cannot delete the role.
    const { data: appData } = await getAppRoles({
      variables: {
        id: currentApplication.id,
      },
    });

    if (name === appData.app.authUserDefaultRole) {
      alert('You cannot delete a role that is the default role.');
      return;
    }

    if (appData.app.authUserDefaultAllowedRoles.includes(name)) {
      alert('You cannot delete a role that is a default allowed role.');
      return;
    }

    const deleteRemoteAppRolePromise = deleteRemoteAppRole({
      variables: {
        role: name,
      },
    });

    await toast.promise(
      deleteRemoteAppRolePromise,
      {
        loading: 'Deleting role...',
        success: 'The role has been deleted successfully.',
        error: 'An error occurred while trying to delete the role.',
      },
      getToastStyleProps(),
    );
  }

  function handleOpenCreator() {
    openDialog('CREATE_ROLE', {
      title: 'Create Role',
      payload: {
        onSubmit: async () => {
          await refetchRoles();
        },
      },
      props: {
        titleProps: { className: '!pb-0' },
        PaperProps: { className: 'max-w-sm' },
      },
    });
  }

  function handleOpenEditor(originalRole: Role) {
    openDialog('EDIT_ROLE', {
      title: 'Edit Role',
      payload: {
        originalRole,
        onSubmit: async () => {
          await refetchRoles();
        },
      },
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
          Are you sure you want to delete the role &quot;
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

  // todo, always put `user` and `me` at the top
  const roles = rolesData.authRoles
    .map((authRole) => ({
      name: authRole.role,
      isSystemRole: SYSTEM_ROLES.includes(authRole.role),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <SettingsContainer
      title="Roles"
      description="Roles are associated with users and is used to manage permissions."
      docsLink="https://docs.nhost.io/authentication/users#roles"
      rootClassName="gap-0"
      className="my-2 px-0"
      slotProps={{ submitButton: { className: 'invisible' } }}
    >
      <Box className="border-b-1 px-4 py-3">
        <Text className="font-medium">Name</Text>
      </Box>

      <div className="grid grid-flow-row gap-2">
        <List>
          {roles.map((role, index) => (
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
                    </>
                  }
                />
              </ListItem.Root>

              <Divider
                component="li"
                className={twMerge(
                  index === roles.length - 1 ? '!mt-4' : '!my-4',
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
