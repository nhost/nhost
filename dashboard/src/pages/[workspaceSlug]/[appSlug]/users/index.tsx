import { useDialog } from '@/components/common/DialogProvider';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import Pagination from '@/components/common/Pagination';
import Container from '@/components/layout/Container';
import ProjectLayout from '@/components/layout/ProjectLayout';
import type { EditUserFormValues } from '@/components/users/EditUserForm';
import UsersBody from '@/components/users/UsersBody';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { useRemoteApplicationGQLClient } from '@/hooks/useRemoteApplicationGQLClient';
import Button from '@/ui/v2/Button';
import PlusIcon from '@/ui/v2/icons/PlusIcon';
import UserIcon from '@/ui/v2/icons/UserIcon';
import Input from '@/ui/v2/Input';
import Text from '@/ui/v2/Text';
import { toastStyleProps } from '@/utils/settings/settingsConstants';
import type { RemoteAppGetUsersQuery } from '@/utils/__generated__/graphql';
import {
  useGetRolesQuery,
  useRemoteAppDeleteUserMutation,
  useRemoteAppGetUsersQuery,
  useTotalUsersQuery,
  useUpdateRemoteAppUserMutation,
} from '@/utils/__generated__/graphql';

import { SearchIcon } from '@heroicons/react/solid';
import debounce from 'lodash.debounce';
import type { ChangeEvent, ReactElement } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { toast } from 'react-hot-toast';

export type RemoteAppUser = Exclude<
  RemoteAppGetUsersQuery['users'][0],
  '__typename'
>;

export default function UsersPage() {
  const { openDialog, openAlertDialog, closeDrawer } = useDialog();
  const remoteProjectGQLClient = useRemoteApplicationGQLClient();
  const [searchString, setSearchString] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteUser] = useRemoteAppDeleteUserMutation({
    client: remoteProjectGQLClient,
  });
  const [updateUser] = useUpdateRemoteAppUserMutation({
    client: remoteProjectGQLClient,
  });
  const limit = useRef(25);
  const [nrOfPages, setNrOfPages] = useState(1);
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const offset = useMemo(() => currentPage - 1, [currentPage]);

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

  /**
   * We want to fetch the queries of the application on this page since we're
   * going to use once the user selects a user of their application; we use it
   * in the drawer form.
   */
  useGetRolesQuery({
    variables: { id: currentApplication.id },
    fetchPolicy: 'cache-first',
    client: remoteProjectGQLClient,
  });

  const {
    data: dataRemoteAppUsers,
    refetch: refetchProjectUsers,
    loading: loadingRemoteAppUsersQuery,
  } = useRemoteAppGetUsersQuery({
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
      limit: limit.current,
      offset: offset * limit.current,
    },
    client: remoteProjectGQLClient,
  });

  /**
   * We want to update the number of pages when the data changes
   * (either fetch for the first time or making a search).
   */
  useEffect(() => {
    if (loadingRemoteAppUsersQuery) {
      return;
    }

    setNrOfPages(
      Math.ceil(
        dataRemoteAppUsers.usersAggregate.aggregate.count / limit.current,
      ),
    );
  }, [dataRemoteAppUsers, loadingRemoteAppUsersQuery]);

  const handleSearchStringChange = useMemo(
    () =>
      debounce((event: ChangeEvent<HTMLInputElement>) => {
        setCurrentPage(1);
        setSearchString(event.target.value);
      }, 500),
    [],
  );

  useEffect(
    () => () => handleSearchStringChange.cancel(),
    [handleSearchStringChange],
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

          await refetchProjectUsers();
        },
        primaryButtonColor: 'error',
        primaryButtonText: 'Delete',
        titleProps: { className: 'mx-auto' },
        PaperProps: { className: 'max-w-lg mx-auto' },
      },
    });
  }

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

    await toast.promise(
      updateUserMutationPromise,
      {
        loading: `Updating user's settings...`,
        success: 'User settings updated successfully',
        error: 'Failed to update user settings.',
      },
      { ...toastStyleProps },
    );
    await refetchProjectUsers();
    closeDrawer();
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
      <div className="grid grid-flow-row gap-2 lg:w-9xl">
        <div className="grid w-full h-full grid-flow-row gap-4 overflow-hidden">
          <div className="grid grid-cols-1 gap-2 px-3 py-3 border-gray-200 md:grid-cols-5 border-b-1 ">
            <Text className="font-medium md:col-span-2">Name</Text>
            <Text className="font-medium">Signed up at</Text>
            <Text className="font-medium">Last Seen</Text>
            <Text className="font-medium">Sign In Methods</Text>
          </div>
          {totalAmountOfUsers !== 0 &&
          dataRemoteAppUsers?.users?.length === 0 ? (
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
            <div className="grid grid-flow-row gap-y-4">
              <UsersBody
                users={dataRemoteAppUsers?.users}
                onDeleteUser={handleDeleteUser}
                onEditUser={handleEditUser}
              />
              <Pagination
                className="px-2"
                totalNrOfPages={nrOfPages}
                currentPageNumber={currentPage}
                elementsPerPage={limit.current}
                onPrevPageClick={() => {
                  setCurrentPage((page) => page - 1);
                }}
                onNextPageClick={() => {
                  setCurrentPage((page) => page + 1);
                }}
                onChangePage={(page) => {
                  setCurrentPage(page);
                }}
              />
            </div>
          )}{' '}
        </div>
      </div>
    </Container>
  );
}

UsersPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
