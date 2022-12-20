import { useDialog } from '@/components/common/DialogProvider';
import Pagination from '@/components/common/Pagination';
import Container from '@/components/layout/Container';
import ProjectLayout from '@/components/layout/ProjectLayout';
import ActivityIndicator from '@/components/ui/v2/ActivityIndicator';
import UsersBody from '@/components/users/UsersBody';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { useRemoteApplicationGQLClient } from '@/hooks/useRemoteApplicationGQLClient';
import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import Text from '@/ui/v2/Text';
import PlusIcon from '@/ui/v2/icons/PlusIcon';
import UserIcon from '@/ui/v2/icons/UserIcon';
import type { RemoteAppGetUsersQuery } from '@/utils/__generated__/graphql';
import { useRemoteAppGetUsersQuery } from '@/utils/__generated__/graphql';
import { generateAppServiceUrl } from '@/utils/helpers';
import { SearchIcon } from '@heroicons/react/solid';
import axios from 'axios';
import debounce from 'lodash.debounce';
import type { ChangeEvent, ReactElement } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

export type RemoteAppUser = Exclude<
  RemoteAppGetUsersQuery['users'][0],
  '__typename'
>;

export default function UsersPage() {
  const { openDialog, closeDialog } = useDialog();
  const remoteProjectGQLClient = useRemoteApplicationGQLClient();
  const [searchString, setSearchString] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);

  const limit = useRef(25);
  const [nrOfPages, setNrOfPages] = useState(1);
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const offset = useMemo(() => currentPage - 1, [currentPage]);

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

    const userCount = searchString
      ? dataRemoteAppUsers?.filteredUsersAggreggate.aggregate.count
      : dataRemoteAppUsers?.usersAggregate?.aggregate?.count;

    setNrOfPages(Math.ceil(userCount / limit.current));
  }, [dataRemoteAppUsers, loadingRemoteAppUsersQuery, searchString]);

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
    const signUpUrl = `${generateAppServiceUrl(
      currentApplication?.subdomain,
      currentApplication?.region.awsName,
      'auth',
    )}/signup/email-password`;

    openDialog('CREATE_USER', {
      title: 'Create User',
      payload: {
        onSubmit: async ({ email, password }) => {
          await axios.post(signUpUrl, {
            email,
            password,
          });
          await refetchProjectUsers();
          closeDialog();
        },
      },
      props: {
        PaperProps: { className: 'max-w-md' },
      },
    });
  }

  const users = useMemo(
    () => dataRemoteAppUsers?.users.map((user) => user) ?? [],
    [dataRemoteAppUsers],
  );

  const usersCount = useMemo(
    () => dataRemoteAppUsers?.usersAggregate?.aggregate?.count ?? -1,
    [dataRemoteAppUsers],
  );

  const thereAreUsers =
    dataRemoteAppUsers?.filteredUsersAggreggate.aggregate.count || usersCount;

  if (loadingRemoteAppUsersQuery) {
    return (
      <Container className="mx-auto overflow-x-hidden max-w-9xl">
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
      </Container>
    );
  }

  return (
    <Container className="mx-auto overflow-x-hidden max-w-9xl">
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
      {usersCount === 0 ? (
        <div className="flex flex-col items-center justify-center px-48 py-12 space-y-5 border rounded-lg shadow-sm border-veryLightGray">
          <UserIcon strokeWidth={1} className="w-10 h-10 text-greyscaleDark" />
          <div className="flex flex-col space-y-1">
            <Text className="font-medium text-center" variant="h3">
              You don&apos;t have any users yet
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
              startIcon={<PlusIcon className="w-4 h-4" />}
            >
              Create User
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-flow-row gap-2 lg:w-9xl">
          <div className="grid w-full h-full grid-flow-row overflow-hidden">
            <div className="grid w-full grid-cols-6 p-3 border-gray-200 border-b-1">
              <Text className="font-medium md:col-span-2">Name</Text>
              <Text className="font-medium ">Signed up at</Text>
              <Text className="font-medium ">Last Seen</Text>
              <Text className="col-span-2 font-medium">OAuth Providers</Text>
            </div>
            {dataRemoteAppUsers?.filteredUsersAggreggate.aggregate.count ===
              0 &&
              usersCount !== 0 && (
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
              )}
            {thereAreUsers && (
              <div className="grid grid-flow-row gap-y-4">
                <UsersBody
                  users={users}
                  onSuccessfulAction={refetchProjectUsers}
                />
                <Pagination
                  className="px-2"
                  totalNrOfPages={nrOfPages}
                  currentPageNumber={currentPage}
                  totalNrOfElements={
                    searchString
                      ? dataRemoteAppUsers?.filteredUsersAggreggate.aggregate
                          .count
                      : dataRemoteAppUsers?.usersAggregate?.aggregate?.count
                  }
                  elementsPerPage={
                    searchString
                      ? dataRemoteAppUsers?.filteredUsersAggreggate.aggregate
                          .count
                      : limit.current
                  }
                  onPrevPageClick={() => {
                    setCurrentPage((page) => page - 1);
                  }}
                  onNextPageClick={() => {
                    setCurrentPage((page) => page + 1);
                  }}
                  onPageChange={(page) => {
                    setCurrentPage(page);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </Container>
  );
}

UsersPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
