import { useDialog } from '@/components/common/DialogProvider';
import FormActivityIndicator from '@/components/common/FormActivityIndicator';
import type { EditUserFormValues } from '@/components/users/EditUserForm';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { useRemoteApplicationGQLClient } from '@/hooks/useRemoteApplicationGQLClient';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Avatar from '@/ui/v2/Avatar';
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
import getReadableProviderName from '@/utils/common/getReadableProviderName';
import getServerError from '@/utils/settings/getServerError';
import getUserRoles from '@/utils/settings/getUserRoles';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import {
  useDeleteRemoteAppUserRolesMutation,
  useGetRolesPermissionsQuery,
  useInsertRemoteAppUserRolesMutation,
  useRemoteAppDeleteUserMutation,
  useUpdateRemoteAppUserMutation,
} from '@/utils/__generated__/graphql';
import { useTheme } from '@mui/material';
import { formatDistance } from 'date-fns';
import kebabCase from 'just-kebab-case';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import type { RemoteAppUser } from 'pages/[workspaceSlug]/[appSlug]/users';
import { Fragment, useMemo } from 'react';
import toast from 'react-hot-toast';

const EditUserForm = dynamic(() => import('@/components/users/EditUserForm'), {
  ssr: false,
  loading: () => <FormActivityIndicator />,
});

export interface UsersBodyProps {
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
  onSubmit?: () => Promise<any>;
}

export default function UsersBody({ users, onSubmit }: UsersBodyProps) {
  const theme = useTheme();
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
  const { data: dataRoles } = useGetRolesPermissionsQuery({
    variables: { appId: currentApplication?.id },
  });

  const { allowed: allowedRoles } = dataRoles?.config?.auth?.user?.roles || {};

  const allAvailableProjectRoles = useMemo(
    () => getUserRoles(allowedRoles),
    [allowedRoles],
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
        error: getServerError(
          `An error occurred while trying to update this user's settings.`,
        ),
      },
      getToastStyleProps(),
    );

    await onSubmit?.();

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
              error: getServerError(
                'An error occurred while trying to delete this user.',
              ),
            },
            getToastStyleProps(),
          );

          await onSubmit();
          closeDrawer();
        },
        primaryButtonColor: 'error',
        primaryButtonText: 'Delete',
      },
    });
  }

  function handleViewUser(user: RemoteAppUser) {
    openDrawer({
      title: 'User Details',
      component: (
        <EditUserForm
          user={user}
          onSubmit={(values) => handleEditUser(values, user)}
          onDeleteUser={handleDeleteUser}
          roles={allAvailableProjectRoles.map((role) => ({
            [role.name]: user.roles.some(
              (userRole) => userRole.role === role.name,
            ),
          }))}
        />
      ),
    });
  }

  if (!users) {
    return (
      <div className="h-screen w-screen overflow-hidden">
        <div className="absolute top-0 left-0 z-50 block h-full w-full">
          <span className="top50percent relative top-1/2 mx-auto my-0 block">
            <ActivityIndicator
              label="Loading users..."
              className="my-auto flex items-center justify-center"
            />
          </span>
        </div>
      </div>
    );
  }

  return (
    <List>
      {users.map((user) => (
        <Fragment key={user.id}>
          <ListItem.Root
            className="h-[64px] w-full"
            secondaryAction={
              <Dropdown.Root>
                <Dropdown.Trigger asChild hideChevron>
                  <IconButton variant="borderless" color="secondary">
                    <DotsHorizontalIcon />
                  </IconButton>
                </Dropdown.Trigger>

                <Dropdown.Content
                  menu
                  PaperProps={{ className: 'w-52' }}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                  <Dropdown.Item
                    onClick={() => {
                      handleViewUser(user);
                    }}
                    className="grid grid-flow-col items-center gap-2 p-2 text-sm+ font-medium"
                  >
                    <UserIcon className="h-4 w-4" />
                    <Text className="font-medium">View User</Text>
                  </Dropdown.Item>

                  <Divider component="li" />

                  <Dropdown.Item
                    className="grid grid-flow-col items-center gap-2 p-2 text-sm+ font-medium"
                    sx={{ color: 'error.main' }}
                    onClick={() => handleDeleteUser(user)}
                  >
                    <TrashIcon className="h-4 w-4" />
                    <Text className="font-medium" color="error">
                      Delete User
                    </Text>
                  </Dropdown.Item>
                </Dropdown.Content>
              </Dropdown.Root>
            }
          >
            <ListItem.Button
              className="grid h-full w-full grid-cols-1 py-2.5 lg:grid-cols-6"
              onClick={() => handleViewUser(user)}
            >
              <div className="col-span-2 grid grid-flow-col place-content-start gap-4">
                <Avatar
                  src={user.avatarUrl}
                  alt={`Avatar of ${user.displayName}`}
                />
                <div className="grid grid-flow-row items-center">
                  <div className="grid grid-flow-col items-center gap-2">
                    <Text className="truncate font-medium leading-5">
                      {user.displayName}
                    </Text>
                    {user.disabled && (
                      <Chip
                        component="span"
                        color="error"
                        size="small"
                        label="Banned"
                      />
                    )}
                  </div>

                  <Text className="truncate font-normal" color="secondary">
                    {user.email}
                  </Text>
                </div>
              </div>

              <Text className="hidden px-2 font-normal md:block">
                {user.createdAt
                  ? `${formatDistance(
                      new Date(user.createdAt),
                      new Date(),
                    )} ago`
                  : '-'}
              </Text>
              <Text className="hidden px-4 font-normal md:block">
                {user.lastSeen
                  ? `${formatDistance(new Date(user.lastSeen), new Date())} ago`
                  : '-'}
              </Text>

              <div className="col-span-2 hidden grid-flow-col place-content-start gap-3 px-4 lg:grid">
                {user.userProviders.length === 0 && (
                  <Text className="col-span-3 font-medium">-</Text>
                )}

                {user.userProviders.slice(0, 4).map((provider) => (
                  <Chip
                    component="span"
                    color="default"
                    size="small"
                    key={provider.id}
                    label={getReadableProviderName(provider.providerId)}
                    sx={{
                      paddingLeft: '0.55rem',
                    }}
                    icon={
                      <Image
                        src={
                          theme.palette.mode === 'dark'
                            ? `/assets/brands/light/${kebabCase(
                                provider.providerId,
                              )}.svg`
                            : `/assets/brands/${kebabCase(
                                provider.providerId,
                              )}.svg`
                        }
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
  );
}
