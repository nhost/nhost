import { useDialog } from '@/components/common/DialogProvider';
import type { EditUserFormValues } from '@/components/users/EditUserForm';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { useRemoteApplicationGQLClient } from '@/hooks/useRemoteApplicationGQLClient';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Chip from '@/ui/v2/Chip';
import Divider from '@/ui/v2/Divider';
import { Dropdown } from '@/ui/v2/Dropdown';
import IconButton from '@/ui/v2/IconButton';
import DotsHorizontalIcon from '@/ui/v2/icons/DotsHorizontalIcon';
import TrashIcon from '@/ui/v2/icons/TrashIcon';
import UserIcon from '@/ui/v2/icons/UserIcon';
import List from '@/ui/v2/List';
import { ListItem } from '@/ui/v2/ListItem';
import Text from '@/ui/v2/Text';
import getUserRoles from '@/utils/settings/getUserRoles';
import { toastStyleProps } from '@/utils/settings/settingsConstants';
import type { RemoteAppGetUsersQuery } from '@/utils/__generated__/graphql';
import {
  useDeleteRemoteAppUserRolesMutation,
  useGetRolesQuery,
  useInsertRemoteAppUserRolesMutation,
  useRemoteAppDeleteUserMutation,
  useUpdateRemoteAppUserMutation,
} from '@/utils/__generated__/graphql';
import type { ApolloQueryResult } from '@apollo/client';
import { Avatar } from '@mui/material';
import { formatDistance } from 'date-fns';
import Image from 'next/image';
import type { RemoteAppUser } from 'pages/[workspaceSlug]/[appSlug]/users';
import { Fragment, useMemo } from 'react';
import toast from 'react-hot-toast';

export interface UsersBodyProps<T = {}> {
  /**
   * The users fetched from entering the users page given a limit and offset.
   * @remark users will be an empty array if there are no users.
   */
  users?: RemoteAppUser[];
  /**
   * Function to be called after a successful action.
   *
   * @example onSuccessfulAction={() => refetch()}
   * @example onSuccessfulAction={() => router.reload()}
   */
  onSuccessfulAction?: () => Promise<void> | void | Promise<T>;
}

export default function UsersBody({
  users,
  onSuccessfulAction,
}: UsersBodyProps<ApolloQueryResult<RemoteAppGetUsersQuery>>) {
  const { openAlertDialog, openDrawer, closeDrawer } = useDialog();
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const remoteProjectGQLClient = useRemoteApplicationGQLClient();

  const [deleteUser] = useRemoteAppDeleteUserMutation({
    client: remoteProjectGQLClient,
  });

  const [updateUser] = useUpdateRemoteAppUserMutation({
    client: remoteProjectGQLClient,
  });

  const [insertUserRoles] = useInsertRemoteAppUserRolesMutation({
    client: remoteProjectGQLClient,
  });

  const [deleteUserRoles] = useDeleteRemoteAppUserRolesMutation({
    client: remoteProjectGQLClient,
  });

  /**
   * We want to fetch the queries of the application on this page since we're
   * going to use once the user selects a user of their application; we use it
   * in the drawer form.
   */
  const { data: dataRoles } = useGetRolesQuery({
    variables: { id: currentApplication?.id },
  });

  const allAvailableProjectRoles = useMemo(
    () => getUserRoles(dataRoles?.app?.authUserDefaultAllowedRoles),
    [dataRoles],
  );

  async function handleEditUser(
    values: EditUserFormValues,
    user: RemoteAppUser,
  ) {
    const updateUserMutationPromise = updateUser({
      variables: {
        id: user.id,
        user: {
          displayName: values.displayName,
          email: values.email,
          avatarUrl: values.avatarURL,
          emailVerified: values.emailVerified,
          defaultRole: values.defaultRole,
          phoneNumber: values.phoneNumber,
          phoneNumberVerified: values.phoneNumberVerified,
          locale: values.locale,
        },
      },
    });

    const newRoles = allAvailableProjectRoles
      .filter((role, i) => values.roles[i] === true)
      .map((role) => role.name);

    const userHasRoles = user.roles.map((role) => role.role);

    const rolesToAdd = newRoles.filter(
      (value) => !userHasRoles.includes(value),
    );

    const rolesToRemove = userHasRoles.filter(
      (value: string) => !newRoles.includes(value),
    );

    if (rolesToAdd.length !== 0) {
      await insertUserRoles({
        variables: {
          roles: rolesToAdd.map((role) => ({
            userId: user.id,
            role,
          })),
        },
      });
    }

    if (rolesToRemove.length !== 0) {
      await deleteUserRoles({
        variables: {
          userId: user.id,
          roles: rolesToRemove,
        },
      });
    }

    await toast.promise(
      updateUserMutationPromise,
      {
        loading: `Updating user's settings...`,
        success: 'User settings updated successfully.',
        error: `An error occurred while trying to update this user's settings.`,
      },
      { ...toastStyleProps },
    );
    await onSuccessfulAction?.();

    closeDrawer();
  }

  function handleDeleteUser(user: RemoteAppUser) {
    openAlertDialog({
      title: 'Delete User',
      payload: (
        <Text>
          Are you sure you want to delete the &quot;
          <strong>{user.displayName}</strong>&quot; user? This cannot be undone.
        </Text>
      ),
      props: {
        onPrimaryAction: async () => {
          await toast.promise(
            deleteUser({
              variables: {
                id: user.id,
              },
            }),
            {
              loading: 'Deleting user...',
              success: 'User deleted successfully.',
              error: 'An error occurred while trying to delete this user.',
            },
            toastStyleProps,
          );

          await onSuccessfulAction();
          closeDrawer();
        },
        primaryButtonColor: 'error',
        primaryButtonText: 'Delete',
      },
    });
  }

  function handleViewUser(user: RemoteAppUser) {
    openDrawer('EDIT_USER', {
      title: 'User Details',

      payload: {
        user,
        onEditUser: handleEditUser,
        onDeleteUser: handleDeleteUser,
        onSuccessfulAction,
        roles: allAvailableProjectRoles.map((role) => ({
          [role.name]: user.roles.some(
            (userRole) => userRole.role === role.name,
          ),
        })),
      },
    });
  }

  return (
    <>
      {!users && (
        <div className="w-screen h-screen overflow-hidden">
          <div className="absolute top-0 left-0 z-50 block w-full h-full">
            <span className="relative block mx-auto my-0 top50percent top-1/2">
              <ActivityIndicator
                label="Loading users..."
                className="flex items-center justify-center my-auto"
              />
            </span>
          </div>
        </div>
      )}

      <List>
        {users.map((user) => (
          <Fragment key={user.id}>
            <ListItem.Root
              className="w-full h-[64px]"
              secondaryAction={
                <Dropdown.Root>
                  <Dropdown.Trigger asChild hideChevron>
                    <IconButton variant="borderless" color="secondary">
                      <DotsHorizontalIcon />
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
                      onClick={() => {
                        handleViewUser(user);
                      }}
                      className="grid grid-flow-col items-center gap-2 p-2 text-sm+ font-medium"
                    >
                      <UserIcon className="w-4 h-4" />
                      <Text className="font-medium">View User</Text>
                    </Dropdown.Item>

                    <Divider component="li" />

                    <Dropdown.Item
                      className="grid grid-flow-col items-center gap-2 p-2 text-sm+ font-medium text-red"
                      onClick={() => handleDeleteUser(user)}
                    >
                      <TrashIcon className="w-4 h-4" />
                      <Text className="font-medium text-red">Delete</Text>
                    </Dropdown.Item>
                  </Dropdown.Content>
                </Dropdown.Root>
              }
            >
              <ListItem.Button
                className="grid lg:grid-cols-6 grid-cols-1 cursor-pointer py-2.5 h-full w-full hover:bg-gray-100 focus:bg-gray-100 focus:outline-none motion-safe:transition-colors"
                onClick={() => handleViewUser(user)}
              >
                <div className="grid grid-flow-col col-span-2 gap-4 place-content-start">
                  <Avatar
                    src={user.avatarUrl}
                    className="border"
                    alt="User's Avatar"
                  />
                  <div className="grid items-center grid-flow-row">
                    <div className="grid items-center grid-flow-col gap-2">
                      <Text className="font-medium leading-5 truncate">
                        {user.displayName}
                      </Text>
                      {user.disabled && (
                        <Chip
                          component="span"
                          color="error"
                          size="small"
                          label="Banned"
                          className="self-center align-middle"
                        />
                      )}
                    </div>

                    <Text className="font-normal truncate text-greyscaleGreyDark">
                      {user.email}
                    </Text>
                  </div>
                </div>

                <Text
                  color="greyscaleDark"
                  className="hidden px-2 font-normal md:block"
                  size="normal"
                >
                  {user.createdAt
                    ? `${formatDistance(
                        new Date(user.createdAt),
                        new Date(),
                      )} ago`
                    : '-'}
                </Text>
                <Text
                  color="greyscaleDark"
                  className="hidden px-4 font-normal md:block"
                  size="normal"
                >
                  {user.lastSeen
                    ? `${formatDistance(
                        new Date(user.lastSeen),
                        new Date(),
                      )} ago`
                    : '-'}
                </Text>

                <div className="hidden grid-flow-col col-span-2 gap-3 px-4 lg:grid place-content-start">
                  {user.userProviders.length === 0 && (
                    <Text className="col-span-3 font-medium">-</Text>
                  )}

                  {user.userProviders.slice(0, 4).map((provider) => (
                    <Chip
                      component="span"
                      color="default"
                      size="small"
                      key={provider.id}
                      label={
                        provider.providerId === 'github'
                          ? 'GitHub'
                          : provider.providerId
                      }
                      className="capitalize"
                      sx={{
                        paddingLeft: '0.55rem',
                      }}
                      icon={
                        <Image
                          src={`/logos/${provider.providerId}.svg`}
                          width={16}
                          height={16}
                        />
                      }
                    />
                  ))}

                  {user.userProviders.length > 3 && (
                    <Chip
                      component="span"
                      color="default"
                      size="small"
                      label={`+${user.userProviders.length - 3}`}
                      className="font-medium"
                    />
                  )}
                </div>
              </ListItem.Button>
            </ListItem.Root>
            <Divider component="li" />
          </Fragment>
        ))}
      </List>
    </>
  );
}
