import { formatDistance } from 'date-fns';
import kebabCase from 'just-kebab-case';
import {
  Ellipsis as DotsHorizontalIcon,
  Trash2 as TrashIcon,
  UserIcon,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useDialog } from '@/components/common/DialogProvider';
import { FormActivityIndicator } from '@/components/form/FormActivityIndicator';
import { Avatar } from '@/components/ui/v3/avatar';
import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import type { EditUserFormValues } from '@/features/orgs/projects/authentication/users/components/EditUserForm';
import { getReadableProviderName } from '@/features/orgs/projects/authentication/users/utils/getReadableProviderName';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useDeleteRemoteAppUserRolesMutation,
  useInsertRemoteAppUserRolesMutation,
  useRemoteAppDeleteUserMutation,
  useUpdateRemoteAppUserMutation,
} from '@/generated/graphql';
import type { RemoteAppUser } from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/auth/users';
import { useThemePreference } from '@/providers/Theme';
import type { Role } from '@/types/application';

const EditUserForm = dynamic(
  () =>
    import(
      '@/features/orgs/projects/authentication/users/components/EditUserForm/EditUserForm'
    ),
  {
    ssr: false,
    loading: () => <FormActivityIndicator />,
  },
);

export interface UsersBodyProps {
  /**
   * The users fetched from entering the users page given a limit and offset.
   * @remark users will be an empty array if there are no users.
   */
  users: RemoteAppUser[];
  /**
   * Function to be called after a successful action.
   */
  onSubmit: () => Promise<unknown>;
  allAvailableProjectRoles: Role[];
}

export default function UsersBody({
  users,
  onSubmit,
  allAvailableProjectRoles,
}: UsersBodyProps) {
  const { resolvedTheme } = useThemePreference();
  const { openAlertDialog, openDrawer, closeDrawer } = useDialog();
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
          ...(values?.metadata !== undefined && values.metadata !== ''
            ? (() => {
                try {
                  return { metadata: JSON.parse(values.metadata) };
                } catch {
                  return { metadata: null };
                }
              })()
            : { metadata: null }),
        },
      },
    });

    const newRoles = allAvailableProjectRoles
      .filter((_role, i) => values.roles?.[i] === true)
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

    await execPromiseWithErrorToast(
      async () => {
        await updateUserMutationPromise;
      },
      {
        loadingMessage: `Updating user's settings...`,
        successMessage: 'User settings have been updated successfully.',
        errorMessage: `An error occurred while trying to update this user's settings.`,
      },
    );

    await onSubmit?.();
    closeDrawer();
  }

  function handleDeleteUser(user: RemoteAppUser) {
    openAlertDialog({
      title: 'Delete User',
      payload: (
        <span>
          Are you sure you want to delete the &quot;
          <strong>{user.displayName}</strong>&quot; user? This cannot be undone.
        </span>
      ),
      props: {
        onPrimaryAction: async () => {
          await execPromiseWithErrorToast(
            async () => {
              await deleteUser({
                variables: {
                  id: user.id,
                },
              });
            },
            {
              loadingMessage: 'Deleting user...',
              successMessage: 'User deleted successfully.',
              errorMessage:
                'An error occurred while trying to delete this user.',
            },
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

  return (
    <ul>
      {users.map((user) => (
        <li key={user.id} className="relative border-b">
          <button
            type="button"
            onClick={() => handleViewUser(user)}
            aria-label={`View ${user.displayName}`}
            className="grid h-[64px] w-full grid-cols-1 py-2.5 pr-12 text-left lg:grid-cols-6"
          >
            <div className="col-span-2 grid grid-flow-col place-content-start gap-4">
              <Avatar
                src={user.avatarUrl}
                alt={`Avatar of ${user.displayName}`}
                name={user.displayName ?? undefined}
              />
              <div className="grid grid-flow-row items-center">
                <div className="grid grid-flow-col items-center gap-2">
                  <p className="truncate font-medium text-foreground leading-5">
                    {user.displayName}
                  </p>
                  {user.disabled && <Badge variant="destructive">Banned</Badge>}
                </div>

                <p className="truncate font-normal text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </div>

            <p className="hidden px-2 font-normal text-foreground md:block">
              {user.createdAt
                ? `${formatDistance(new Date(user.createdAt), new Date())} ago`
                : '-'}
            </p>
            <p className="hidden px-4 font-normal text-foreground md:block">
              {user.lastSeen
                ? `${formatDistance(new Date(user.lastSeen), new Date())} ago`
                : '-'}
            </p>

            <div className="col-span-2 hidden grid-flow-col place-content-start gap-3 px-4 lg:grid">
              {user.userProviders.length === 0 && (
                <p className="col-span-3 font-medium text-foreground">-</p>
              )}

              {user.userProviders.slice(0, 4).map((provider) => (
                <Badge
                  key={provider.id}
                  variant="secondary"
                  className="gap-1.5 font-medium"
                >
                  <Image
                    src={
                      resolvedTheme === 'dark'
                        ? `/assets/brands/light/${kebabCase(
                            provider.providerId,
                          )}.svg`
                        : `/assets/brands/${kebabCase(provider.providerId)}.svg`
                    }
                    width={16}
                    height={16}
                    alt="Oauth provider logo"
                  />
                  {getReadableProviderName(provider.providerId)}
                </Badge>
              ))}

              {user.userProviders.length > 3 && (
                <Badge variant="secondary" className="font-medium">
                  {`+${user.userProviders.length - 3}`}
                </Badge>
              )}
            </div>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1/2 right-2 h-8 w-8 -translate-y-1/2"
                aria-label={`More options for ${user.displayName}`}
              >
                <DotsHorizontalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-52 p-0">
              <DropdownMenuItem
                onClick={() => {
                  handleViewUser(user);
                }}
                className="flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
              >
                <UserIcon className="h-4 w-4" />
                <span>View User</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                className="!text-destructive flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
                onClick={() => handleDeleteUser(user)}
              >
                <TrashIcon className="h-4 w-4" />
                <span>Delete User</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      ))}
    </ul>
  );
}
