import { useDialog } from '@/components/common/DialogProvider';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import Container from '@/components/layout/Container';
import ProjectLayout from '@/components/layout/ProjectLayout';
import UsersBody from '@/components/users/UsersBody';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { useRemoteApplicationGQLClient } from '@/hooks/useRemoteApplicationGQLClient';
import Button from '@/ui/v2/Button';
import PlusIcon from '@/ui/v2/icons/PlusIcon';
import UserIcon from '@/ui/v2/icons/UserIcon';
import Input from '@/ui/v2/Input';
import Text from '@/ui/v2/Text';
import { generateAppServiceUrl } from '@/utils/helpers';
import {
  useRemoteAppDeleteUserMutation,
  useRemoteAppGetUsersQuery,
  useTotalUsersQuery,
} from '@/utils/__generated__/graphql';
import { SearchIcon } from '@heroicons/react/solid';
import { NhostApolloProvider } from '@nhost/react-apollo';
import debounce from 'lodash.debounce';
import type { ChangeEvent, ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { toastStyleProps } from '../settings/general';

export default function UsersPage() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const { openDialog, openAlertDialog } = useDialog();
  const remoteProjectGQLClient = useRemoteApplicationGQLClient();
  const [searchString, setSearchString] = useState<string>('');
  const [currentPage] = useState(1);
  const limit = 25;
  const offset = currentPage - 1;
  const [deleteUser] = useRemoteAppDeleteUserMutation({
    client: remoteProjectGQLClient,
  });

  // merge with the one below
  const {
    data: {
      usersAggregate: {
        aggregate: { count: totalAmountOfUsers },
      },
    } = { usersAggregate: { aggregate: { count: 0 } } },
    loading,
  } = useTotalUsersQuery({
    client: remoteProjectGQLClient,
  });

  const { data: dataRemoteAppUsers, refetch: refetchProjectUsers } =
    useRemoteAppGetUsersQuery({
      variables: {
        where: {
          _or: [
            {
              displayName: {
                _ilike: `%${searchString}%`,
              },
            },
            {
              email: {
                _ilike: `%${searchString}%`,
              },
            },
          ],
        },
        limit,
        offset: offset * limit,
      },
      client: remoteProjectGQLClient,
      fetchPolicy: 'cache-first',
    });

  const handleSearchStringChange = useMemo(
    () =>
      debounce((event: ChangeEvent<HTMLInputElement>) => {
        event.preventDefault();
        setSearchString(event.target.value);
      }, 500),
    [],
  );

  function handleCreateUser() {
    openDialog('CREATE_USER', {
      title: 'Create User',
      payload: {
        onSubmit: async () => {
          await refetchProjectUsers();
        },
      },
      props: {
        titleProps: { className: 'mx-auto' },
        PaperProps: { className: 'max-w-md' },
      },
    });
  }

  async function handleDeleteUser(user) {
    const deleteUserPromise = deleteUser({
      variables: {
        id: user.id,
      },
    });

    await toast.promise(
      deleteUserPromise,
      {
        loading: 'Deleting user...',
        success: 'User deleted successfully.',
        error: 'An error occurred while trying to delete this user.',
      },
      toastStyleProps,
    );

    await refetchProjectUsers();
  }

  function handleConfirmDeleteUser(user) {
    openAlertDialog({
      title: 'Delete User',
      payload: (
        <Text>
          Are you sure you want to delete the &quot;
          <strong>{user.displayName}</strong>&quot; user? This cannot be undone.
        </Text>
      ),
      props: {
        onPrimaryAction: () => handleDeleteUser(user),
        primaryButtonColor: 'error',
        primaryButtonText: 'Delete',
        titleProps: { className: 'mx-auto' },
        PaperProps: { className: 'max-w-lg mx-auto' },
      },
    });
  }

  if (loading) {
    return <LoadingScreen />;
  }

  if (totalAmountOfUsers === 0) {
    return (
      <Container className="mx-auto max-w-9xl">
        <div className="flex flex-row place-content-between">
          <Input
            className="rounded-sm"
            placeholder="Search users"
            startAdornment={
              <SearchIcon className="w-4 h-4 ml-2 -mr-1 text-greyscaleDark shrink-0" />
            }
            onChange={handleSearchStringChange}
            disabled
          />
          <Button
            onClick={handleCreateUser}
            startIcon={<PlusIcon className="w-4 h-4" />}
            className="grid h-full grid-flow-col gap-1 p-2 place-items-center"
            size="small"
          >
            Create User
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center px-48 py-12 space-y-5 border rounded-lg shadow-sm border-veryLightGray">
          <UserIcon strokeWidth={1} className="w-10 h-10 text-greyscaleDark" />
          <div className="flex flex-col space-y-1">
            <Text className="font-medium text-center" variant="h3">
              You dont have any users yet
            </Text>
            <Text variant="subtitle1" className="text-center">
              All users for your project will be listed here
            </Text>
          </div>
          <div className="flex flex-row place-content-between rounded-lg lg:w-[230px]">
            <Button
              variant="contained"
              color="primary"
              className="w-full"
              aria-label="Create User"
              onClick={handleCreateUser}
            >
              Create User
            </Button>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <NhostApolloProvider
      graphqlUrl={`${generateAppServiceUrl(
        currentApplication.subdomain,
        currentApplication.region.awsName,
        'graphql',
      )}/v1`}
      fetchPolicy="cache-first"
      headers={{
        'x-hasura-admin-secret':
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? 'nhost-admin-secret'
            : currentApplication.hasuraGraphqlAdminSecret,
      }}
    >
      <Container className="mx-auto max-w-9xl">
        <div className="flex flex-row place-content-between">
          <Input
            className="rounded-sm"
            placeholder="Search users"
            startAdornment={
              <SearchIcon className="w-4 h-4 ml-2 -mr-1 text-greyscaleDark shrink-0" />
            }
            onChange={handleSearchStringChange}
          />
          <Button
            onClick={handleCreateUser}
            startIcon={<PlusIcon className="w-4 h-4" />}
            className="grid h-full grid-flow-col gap-1 p-2 place-items-center"
            size="small"
          >
            Create User
          </Button>
        </div>
        {totalAmountOfUsers !== 0 && dataRemoteAppUsers?.users?.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-48 py-12 space-y-5 border rounded-lg shadow-sm border-veryLightGray">
            <UserIcon
              strokeWidth={1}
              className="w-10 h-10 text-greyscaleDark"
            />
            <div className="flex flex-col space-y-1">
              <Text className="font-medium text-center" variant="h3">
                No results for &quot;{searchString}&quot;
              </Text>
              <Text variant="subtitle1" className="text-center">
                Try a different search
              </Text>
            </div>
          </div>
        ) : (
          <UsersBody
            users={dataRemoteAppUsers?.users}
            onDeleteUser={handleConfirmDeleteUser}
          />
        )}
      </Container>
    </NhostApolloProvider>
  );
}

UsersPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
