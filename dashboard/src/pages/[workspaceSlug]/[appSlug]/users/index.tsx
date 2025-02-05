import { useDialog } from '@/components/common/DialogProvider';
import { Pagination } from '@/components/common/Pagination';
import { Container } from '@/components/layout/Container';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { SearchIcon } from '@/components/ui/v2/icons/SearchIcon';
import { UserIcon } from '@/components/ui/v2/icons/UserIcon';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { CreateUserForm } from '@/features/authentication/users/components/CreateUserForm';
import { UsersBody } from '@/features/authentication/users/components/UsersBody';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { useRemoteApplicationGQLClient } from '@/hooks/useRemoteApplicationGQLClient';
import type { RemoteAppGetUsersAndAuthRolesQuery } from '@/utils/__generated__/graphql';
import { useRemoteAppGetUsersAndAuthRolesQuery } from '@/utils/__generated__/graphql';
import debounce from 'lodash.debounce';
import Router, { useRouter } from 'next/router';
import type { ChangeEvent, ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type RemoteAppUser = Exclude<
  RemoteAppGetUsersAndAuthRolesQuery['users'][0],
  '__typename'
>;

export default function UsersPage() {
  const { openDialog } = useDialog();
  const remoteProjectGQLClient = useRemoteApplicationGQLClient();
  const [searchString, setSearchString] = useState<string>('');

  const limit = useRef(25);
  const router = useRouter();
  const [nrOfPages, setNrOfPages] = useState(
    parseInt(router.query.page as string, 10) || 1,
  );

  const [currentPage, setCurrentPage] = useState(
    parseInt(router.query.page as string, 10) || 1,
  );

  const offset = useMemo(() => currentPage - 1, [currentPage]);

  const remoteAppGetUserVariables = useMemo(
    () => ({
      where:
        router.query.userId !== undefined
          ? {
              id: {
                _eq: searchString,
              },
            }
          : {
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
    }),
    [router.query.userId, searchString, offset],
  );

  const {
    data: dataRemoteAppUsers,
    refetch: refetchProjectUsers,
    loading: loadingRemoteAppUsersQuery,
  } = useRemoteAppGetUsersAndAuthRolesQuery({
    variables: remoteAppGetUserVariables,
    client: remoteProjectGQLClient,
  });

  /**
   * This function will remove query params from the URL.
   *
   * @remarks This function is used when we want to update the URL query
   * params without refreshing the page. For example if we want to remove
   * the page query param from the URL when we are on the first page.
   *
   * @param removeList - List of query params we want to remove from the URL
   */
  const removeQueryParamsFromRouter = useCallback(
    (removeList: string[] = []) => {
      if (removeList.length > 0) {
        removeList.forEach(
          (param: string | number) => delete Router.query[param],
        );
      } else {
        // Remove all
        Object.keys(Router.query).forEach(
          (param) => delete Router.query[param],
        );
      }
      Router.replace(
        {
          pathname: Router.pathname,
          query: Router.query,
        },
        undefined,
        /**
         * Do not refresh the page
         */
        { shallow: true },
      );
    },
    [],
  );

  /**
   * If a user of the app enters the users tab with a page query param of the following structure:
   * `users?page=2` this useEffect will update the current page to 2.
   * which in turn will update the offset and trigger fetching the data with the new variables.
   * If the user enters a page number that is greater than the number of pages we will redirect
   * the user to the first page and update the URL.
   *
   * @remarks If the user navigates the page back and forth we handle the URL change through
   * props passed to the Pagination component.
   * @see {@link Pagination}
   *
   */
  useEffect(() => {
    if (router.query.page === undefined) {
      setCurrentPage(1);
      return;
    }
    if (router.query.page && typeof router.query.page === 'string') {
      const pageNumber = parseInt(router.query.page, 10);
      if (nrOfPages >= pageNumber) {
        setCurrentPage(pageNumber);
      } else {
        setCurrentPage(1);
      }
    }
  }, [nrOfPages, router.query.page]);

  /**
   * If the user is on the first page, we want to remove the page query param from the URL.
   * e.g. `users?page=1` -> `users`
   */
  useEffect(() => {
    if (currentPage === 1) {
      removeQueryParamsFromRouter(['page']);
    }
  }, [currentPage, removeQueryParamsFromRouter]);

  /**
   * If the users enters the page with a page query param with the following structure:
   * `users?userId=<id>` this useEffect will update the search string to the id.
   * which in turn will trigger fetching the data with the new variables.
   *
   */
  useEffect(() => {
    if (router.query.userId && typeof router.query.userId === 'string') {
      setSearchString(router.query.userId);
    }
  }, [router.query.userId]);

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
  }, [
    dataRemoteAppUsers?.filteredUsersAggreggate.aggregate.count,
    dataRemoteAppUsers?.usersAggregate.aggregate.count,
    loadingRemoteAppUsersQuery,
    searchString,
  ]);

  const handleSearchStringChange = useMemo(
    () =>
      debounce((event: ChangeEvent<HTMLInputElement>) => {
        setCurrentPage(1);
        setSearchString(event.target.value);
      }, 1000),
    [],
  );

  useEffect(
    () => () => handleSearchStringChange.cancel(),
    [handleSearchStringChange],
  );

  function openCreateUserDialog() {
    openDialog({
      title: 'Create User',
      component: <CreateUserForm onSubmit={refetchProjectUsers} />,
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
    dataRemoteAppUsers?.filteredUsersAggreggate.aggregate.count ||
    usersCount <= 0;

  if (loadingRemoteAppUsersQuery) {
    return (
      <Container
        className="flex h-full max-w-9xl flex-col"
        rootClassName="h-full"
      >
        <div className="flex shrink-0 grow-0 flex-row place-content-between">
          <Input
            className="rounded-sm"
            placeholder="Search users"
            startAdornment={
              <SearchIcon
                className="-mr-1 ml-2 h-4 w-4 shrink-0"
                sx={{ color: 'text.disabled' }}
              />
            }
            onChange={handleSearchStringChange}
          />
          <Button
            onClick={openCreateUserDialog}
            startIcon={<PlusIcon className="h-4 w-4" />}
            size="small"
          >
            Create User
          </Button>
        </div>

        <div className="flex flex-auto items-center justify-center overflow-hidden">
          <ActivityIndicator label="Loading users..." />
        </div>
      </Container>
    );
  }

  return (
    <Container className="mx-auto max-w-9xl space-y-5 overflow-x-hidden">
      <div className="flex flex-row place-content-between">
        <Input
          className="rounded-sm"
          placeholder="Search users"
          startAdornment={
            <SearchIcon
              className="-mr-1 ml-2 h-4 w-4 shrink-0"
              sx={{ color: 'text.disabled' }}
            />
          }
          onChange={handleSearchStringChange}
        />
        <Button
          onClick={openCreateUserDialog}
          startIcon={<PlusIcon className="h-4 w-4" />}
          size="small"
        >
          Create User
        </Button>
      </div>
      {usersCount === 0 ? (
        <Box className="flex flex-col items-center justify-center space-y-5 rounded-lg border px-48 py-12 shadow-sm">
          <UserIcon
            strokeWidth={1}
            className="h-10 w-10"
            sx={{ color: 'text.disabled' }}
          />
          <div className="flex flex-col space-y-1">
            <Text className="text-center font-medium" variant="h3">
              There are no users yet
            </Text>
            <Text variant="subtitle1" className="text-center">
              All users for your project will be listed here.
            </Text>
          </div>
          <div className="flex flex-row place-content-between rounded-lg lg:w-[230px]">
            <Button
              variant="contained"
              color="primary"
              className="w-full"
              onClick={openCreateUserDialog}
              startIcon={<PlusIcon className="h-4 w-4" />}
            >
              Create User
            </Button>
          </div>
        </Box>
      ) : (
        <div className="lg:w-9xl grid grid-flow-row gap-2">
          <div className="grid h-full w-full grid-flow-row overflow-hidden pb-4">
            <Box className="grid w-full border-b p-2 md:grid-cols-6">
              <Text className="font-medium md:col-span-2">Name</Text>
              <Text className="hidden font-medium md:block">Signed up at</Text>
              <Text className="hidden font-medium md:block">Last Seen</Text>
              <Text className="col-span-2 hidden font-medium md:block">
                OAuth Providers
              </Text>
            </Box>
            {dataRemoteAppUsers?.filteredUsersAggreggate.aggregate.count ===
              0 &&
              usersCount !== 0 && (
                <Box className="flex flex-col items-center justify-center space-y-5 border-x border-b px-48 py-12">
                  <UserIcon
                    strokeWidth={1}
                    className="h-10 w-10"
                    sx={{ color: 'text.disabled' }}
                  />
                  <div className="flex flex-col space-y-1">
                    <Text className="text-center font-medium" variant="h3">
                      No results for &quot;{searchString}&quot;
                    </Text>
                    <Text variant="subtitle1" className="text-center">
                      Try a different search
                    </Text>
                  </div>
                </Box>
              )}
            {thereAreUsers && (
              <div className="grid grid-flow-row gap-4">
                <UsersBody users={users} onSubmit={refetchProjectUsers} />
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
                  itemsLabel="users"
                  elementsPerPage={
                    searchString
                      ? dataRemoteAppUsers?.filteredUsersAggreggate.aggregate
                          .count
                      : limit.current
                  }
                  onPrevPageClick={async () => {
                    setCurrentPage((page) => page - 1);
                    if (currentPage - 1 !== 1) {
                      await router.push({
                        pathname: router.pathname,
                        query: { ...router.query, page: currentPage - 1 },
                      });
                    }
                  }}
                  onNextPageClick={async () => {
                    setCurrentPage((page) => page + 1);
                    await router.push({
                      pathname: router.pathname,
                      query: { ...router.query, page: currentPage + 1 },
                    });
                  }}
                  onPageChange={async (page) => {
                    setCurrentPage(page);
                    await router.push({
                      pathname: router.pathname,
                      query: { ...router.query, page },
                    });
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
