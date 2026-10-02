import debounce from 'lodash.debounce';
import { PlusIcon, SearchIcon, UserIcon } from 'lucide-react';
import { useRouter } from 'next/router';
import type { ChangeEvent, ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { Pagination } from '@/components/common/Pagination';
import { Container } from '@/components/layout/Container';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Button } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import { Spinner } from '@/components/ui/v3/spinner';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { CreateUserForm } from '@/features/orgs/projects/authentication/users/components/CreateUserForm';
import { UsersBody } from '@/features/orgs/projects/authentication/users/components/UsersBody';
import {
  getPageNumberFromQuery,
  useUrlPagination,
} from '@/features/orgs/projects/common/hooks/useUrlPagination';
import { getUserRoles } from '@/features/orgs/projects/roles/settings/utils/getUserRoles';
import type { RemoteAppGetUsersAndAuthRolesQuery } from '@/generated/graphql';
import { useRemoteAppGetUsersAndAuthRolesQuery } from '@/generated/graphql';
import { isNotEmptyValue } from '@/lib/utils';
import { getPaginationOffset } from '@/utils/getPaginationOffset';

export type RemoteAppUser = Exclude<
  RemoteAppGetUsersAndAuthRolesQuery['users'][0],
  '__typename'
>;

const ELEMENTS_PER_PAGE = 25;

export default function UsersPage() {
  return (
    <RetryableErrorBoundary>
      <UsersPageContent />
    </RetryableErrorBoundary>
  );
}

function UsersPageContent() {
  const { openDialog } = useDialog();
  const remoteProjectGQLClient = useRemoteApplicationGQLClient();
  const [searchString, setSearchString] = useState<string>('');

  const router = useRouter();

  const currentPage = getPageNumberFromQuery(router.query.page);

  const offset = useMemo(
    () => getPaginationOffset(currentPage, ELEMENTS_PER_PAGE),
    [currentPage],
  );

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
      limit: ELEMENTS_PER_PAGE,
      offset,
    }),
    [router.query.userId, searchString, offset],
  );

  const {
    data: dataRemoteAppUsersAndAuthRoles,
    refetch: refetchProjectUsers,
    loading: loadingRemoteAppUsersQuery,
    error: remoteAppUsersError,
  } = useRemoteAppGetUsersAndAuthRolesQuery({
    variables: remoteAppGetUserVariables,
    client: remoteProjectGQLClient,
  });

  const totalUsersCount = searchString
    ? (dataRemoteAppUsersAndAuthRoles?.filteredUsersAggreggate?.aggregate
        ?.count ?? 0)
    : (dataRemoteAppUsersAndAuthRoles?.usersAggregate?.aggregate?.count ?? 0);

  const { nrOfPages, goToPage, goToNextPage, goToPreviousPage } =
    useUrlPagination({
      currentPage,
      elementsPerPage: ELEMENTS_PER_PAGE,
      totalNrOfElements: totalUsersCount,
      loading: loadingRemoteAppUsersQuery,
    });

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

  const handleSearchStringChange = useMemo(
    () =>
      debounce((event: ChangeEvent<HTMLInputElement>) => {
        goToPage(1);
        setSearchString(event.target.value);
      }, 1000),
    [goToPage],
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

  const users = dataRemoteAppUsersAndAuthRoles?.users ?? [];

  const usersCount = useMemo(
    () =>
      dataRemoteAppUsersAndAuthRoles?.usersAggregate?.aggregate?.count ?? -1,
    [dataRemoteAppUsersAndAuthRoles],
  );

  const authRoles = (dataRemoteAppUsersAndAuthRoles?.authRoles || []).map(
    (authRole) => authRole.role,
  );
  const allAvailableProjectRoles = useMemo(
    () => getUserRoles(authRoles),
    [authRoles],
  );

  const thereAreUsers =
    dataRemoteAppUsersAndAuthRoles?.filteredUsersAggreggate.aggregate?.count ||
    usersCount <= 0;

  if (loadingRemoteAppUsersQuery) {
    return (
      <Container
        className="flex h-full max-w-9xl flex-col"
        rootClassName="h-full"
      >
        <div className="flex shrink-0 grow-0 flex-col gap-3 sm:flex-row sm:place-content-between sm:items-center">
          <Input
            className="rounded-sm pl-9"
            wrapperClassName="w-full sm:w-72"
            placeholder="Search users"
            prefix={<SearchIcon className="h-4 w-4 text-muted-foreground" />}
            onChange={handleSearchStringChange}
          />
          <Button
            onClick={openCreateUserDialog}
            size="sm"
            className="w-full sm:w-auto"
          >
            <PlusIcon className="mr-2 h-4 w-4" />
            Create User
          </Button>
        </div>

        <div className="flex flex-auto items-center justify-center overflow-hidden">
          <Spinner size="medium" wrapperClassName="gap-2">
            Loading users...
          </Spinner>
        </div>
      </Container>
    );
  }

  if (remoteAppUsersError) {
    throw remoteAppUsersError;
  }

  const elementsPerPage =
    searchString &&
    isNotEmptyValue(
      dataRemoteAppUsersAndAuthRoles?.filteredUsersAggreggate.aggregate?.count,
    )
      ? dataRemoteAppUsersAndAuthRoles.filteredUsersAggreggate.aggregate.count
      : ELEMENTS_PER_PAGE;
  const totalNrOfElements =
    searchString &&
    isNotEmptyValue(
      dataRemoteAppUsersAndAuthRoles?.filteredUsersAggreggate.aggregate?.count,
    )
      ? dataRemoteAppUsersAndAuthRoles.filteredUsersAggreggate.aggregate.count
      : (dataRemoteAppUsersAndAuthRoles?.usersAggregate?.aggregate?.count ?? 0);
  return (
    <Container className="mx-auto max-w-9xl space-y-5 overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:place-content-between sm:items-center">
        <Input
          className="rounded-sm pl-9"
          wrapperClassName="w-full sm:w-72"
          placeholder="Search users"
          prefix={<SearchIcon className="h-4 w-4 text-muted-foreground" />}
          onChange={handleSearchStringChange}
        />
        <Button
          onClick={openCreateUserDialog}
          size="sm"
          className="w-full sm:w-auto"
        >
          <PlusIcon className="mr-2 h-4 w-4" />
          Create User
        </Button>
      </div>
      {usersCount === 0 ? (
        <div className="flex flex-col items-center justify-center space-y-5 rounded-lg border px-4 py-12 shadow-sm sm:px-48">
          <UserIcon strokeWidth={1} className="h-10 w-10 text-disabled" />
          <div className="flex flex-col space-y-1">
            <h3 className="text-center font-medium text-foreground text-lg">
              There are no users yet
            </h3>
            <p className="text-center text-muted-foreground text-sm">
              All users for your project will be listed here.
            </p>
          </div>
          <div className="flex flex-row place-content-between rounded-lg lg:w-[230px]">
            <Button className="w-full" onClick={openCreateUserDialog}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Create User
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-flow-row gap-2 lg:w-9xl">
          <div className="grid h-full w-full grid-flow-row overflow-hidden pb-4">
            <div className="grid w-full border-b p-2 md:grid-cols-6">
              <p className="font-medium text-foreground md:col-span-2">Name</p>
              <p className="hidden font-medium text-foreground md:block">
                Signed up at
              </p>
              <p className="hidden font-medium text-foreground md:block">
                Last Seen
              </p>
              <p className="col-span-2 hidden font-medium text-foreground md:block">
                OAuth Providers
              </p>
            </div>
            {dataRemoteAppUsersAndAuthRoles?.filteredUsersAggreggate.aggregate
              ?.count === 0 &&
              usersCount !== 0 && (
                <div className="flex flex-col items-center justify-center space-y-5 border-x border-b px-48 py-12">
                  <UserIcon
                    strokeWidth={1}
                    className="h-10 w-10 text-disabled"
                  />
                  <div className="flex flex-col space-y-1">
                    <h3 className="text-center font-medium text-foreground text-lg">
                      No results for &quot;{searchString}&quot;
                    </h3>
                    <p className="text-center text-muted-foreground text-sm">
                      Try a different search
                    </p>
                  </div>
                </div>
              )}
            {thereAreUsers && (
              <div className="grid grid-flow-row gap-4">
                <UsersBody
                  users={users}
                  onSubmit={refetchProjectUsers}
                  allAvailableProjectRoles={allAvailableProjectRoles}
                />
                <Pagination
                  className="px-2"
                  totalNrOfPages={nrOfPages}
                  currentPageNumber={currentPage}
                  totalNrOfElements={totalNrOfElements}
                  itemsLabel="users"
                  elementsPerPage={elementsPerPage}
                  onPrevPageClick={goToPreviousPage}
                  onNextPageClick={goToNextPage}
                  onPageChange={goToPage}
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
  return <OrgLayout>{page}</OrgLayout>;
};
