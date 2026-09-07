import debounce from 'lodash.debounce';
import { PlusIcon, SearchIcon } from 'lucide-react';
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
import { MIN_AUTH_VERSION_OAUTH2 } from '@/features/orgs/projects/authentication/oauth2/constants';
import { CreateOAuth2ClientForm } from '@/features/orgs/projects/authentication/oauth2-clients/components/CreateOAuth2ClientForm';
import { OAuth2ClientsList } from '@/features/orgs/projects/authentication/oauth2-clients/components/OAuth2ClientsList';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useSoftwareVersionsInfo } from '@/features/orgs/projects/common/hooks/useSoftwareVersionsInfo';
import {
  getPageNumberFromQuery,
  useUrlPagination,
} from '@/features/orgs/projects/common/hooks/useUrlPagination';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  useGetOAuth2ClientsQuery,
  useGetOAuth2ProviderSettingsQuery,
} from '@/generated/graphql';
import { isVersionGte } from '@/utils/compareVersions';
import { getPaginationOffset } from '@/utils/getPaginationOffset';

const ELEMENTS_PER_PAGE = 25;

export default function OAuth2ClientsPage() {
  return (
    <RetryableErrorBoundary>
      <OAuth2ClientsPageContent />
    </RetryableErrorBoundary>
  );
}

function OAuth2ClientsPageContent() {
  const { openDrawer } = useDialog();
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const remoteProjectGQLClient = useRemoteApplicationGQLClient();
  const router = useRouter();
  const { auth, loading: loadingVersions } = useSoftwareVersionsInfo();

  const [searchString, setSearchString] = useState('');
  const currentPage = getPageNumberFromQuery(router.query.page);

  const offset = useMemo(
    () => getPaginationOffset(currentPage, ELEMENTS_PER_PAGE),
    [currentPage],
  );

  const where = useMemo(() => {
    if (!searchString) {
      return {};
    }
    return {
      _or: [
        { clientId: { _ilike: `%${searchString}%` } },
        { metadata: { _cast: { String: { _ilike: `%${searchString}%` } } } },
      ],
    };
  }, [searchString]);

  const {
    data: settingsData,
    loading: settingsLoading,
    error: settingsError,
  } = useGetOAuth2ProviderSettingsQuery({
    variables: { appId: project?.id },
    fetchPolicy: 'cache-and-network',
    skip: !project?.id,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const oauth2Enabled = !!settingsData?.config?.auth?.oauth2Provider?.enabled;

  const {
    data: clientsData,
    loading: clientsLoading,
    error: clientsError,
    refetch: refetchClients,
  } = useGetOAuth2ClientsQuery({
    variables: { limit: ELEMENTS_PER_PAGE, offset, where },
    client: remoteProjectGQLClient,
    skip: !oauth2Enabled,
    fetchPolicy: 'cache-and-network',
  });

  const totalNrOfElements =
    clientsData?.authOauth2ClientsAggregate?.aggregate?.count ?? 0;

  const { nrOfPages, goToPage, goToNextPage, goToPreviousPage } =
    useUrlPagination({
      currentPage,
      elementsPerPage: ELEMENTS_PER_PAGE,
      totalNrOfElements,
      loading: clientsLoading,
    });

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

  function openCreateClientDrawer() {
    openDrawer({
      title: 'Create OAuth2 Client',
      component: <CreateOAuth2ClientForm onSubmit={() => refetchClients()} />,
    });
  }

  if (isPlatform && loadingVersions) {
    return (
      <Container
        className="flex h-full max-w-9xl flex-col"
        rootClassName="h-full"
      >
        <div className="flex flex-auto items-center justify-center overflow-hidden">
          <Spinner size="medium" wrapperClassName="gap-2">
            Loading...
          </Spinner>
        </div>
      </Container>
    );
  }

  if (
    isPlatform &&
    !isVersionGte(auth.configuredVersion, MIN_AUTH_VERSION_OAUTH2)
  ) {
    return (
      <Container className="mx-auto max-w-9xl space-y-5">
        <div className="flex flex-col items-center justify-center space-y-5 rounded-lg border px-48 py-12 shadow-sm">
          <div className="flex flex-col space-y-1">
            <h3 className="text-center font-medium text-foreground text-lg">
              Auth Version Too Old
            </h3>
            <p className="text-center text-muted-foreground text-sm">
              OAuth2 Clients require Auth version {MIN_AUTH_VERSION_OAUTH2} or
              later. Please upgrade your Auth service in the Settings page.
            </p>
          </div>
          <Button
            onClick={() =>
              router.push(
                `/orgs/${router.query.orgSlug}/projects/${router.query.appSubdomain}/settings/authentication`,
              )
            }
          >
            Go to Auth Settings
          </Button>
        </div>
      </Container>
    );
  }

  if (settingsLoading) {
    return (
      <Container
        className="flex h-full max-w-9xl flex-col"
        rootClassName="h-full"
      >
        <div className="flex flex-auto items-center justify-center overflow-hidden">
          <Spinner size="medium" wrapperClassName="gap-2">
            Loading OAuth2 settings...
          </Spinner>
        </div>
      </Container>
    );
  }

  if (settingsError) {
    throw settingsError;
  }

  if (!oauth2Enabled) {
    return (
      <Container className="mx-auto max-w-9xl space-y-5">
        <div className="flex flex-col items-center justify-center space-y-5 rounded-lg border px-48 py-12 shadow-sm">
          <div className="flex flex-col space-y-1">
            <h3 className="text-center font-medium text-foreground text-lg">
              OAuth2 Provider is Disabled
            </h3>
            <p className="text-center text-muted-foreground text-sm">
              Enable the OAuth2 provider in settings to manage OAuth2 clients.
            </p>
          </div>
          <Button
            onClick={() =>
              router.push(
                `/orgs/${router.query.orgSlug}/projects/${router.query.appSubdomain}/settings/oauth2-provider`,
              )
            }
          >
            Go to OAuth2 Provider Settings
          </Button>
        </div>
      </Container>
    );
  }

  if (clientsLoading) {
    return (
      <Container
        className="flex h-full max-w-9xl flex-col"
        rootClassName="h-full"
      >
        <div className="flex shrink-0 grow-0 flex-row place-content-between">
          <Input
            className="rounded-sm pl-9"
            wrapperClassName="w-full max-w-xs"
            placeholder="Search clients"
            prefix={<SearchIcon className="h-4 w-4 text-muted-foreground" />}
            onChange={handleSearchStringChange}
          />
          <Button onClick={openCreateClientDrawer} size="sm">
            <PlusIcon className="mr-2 h-4 w-4" />
            Create Client
          </Button>
        </div>
        <div className="flex flex-auto items-center justify-center overflow-hidden">
          <Spinner size="medium" wrapperClassName="gap-2">
            Loading OAuth2 clients...
          </Spinner>
        </div>
      </Container>
    );
  }

  if (clientsError) {
    throw clientsError;
  }

  const clients = clientsData?.authOauth2Clients ?? [];
  const clientsCount = totalNrOfElements;

  return (
    <Container className="mx-auto max-w-9xl space-y-5 overflow-x-hidden">
      <div className="flex flex-row place-content-between">
        <Input
          className="rounded-sm pl-9"
          wrapperClassName="w-full max-w-xs"
          placeholder="Search clients"
          prefix={<SearchIcon className="h-4 w-4 text-muted-foreground" />}
          onChange={handleSearchStringChange}
        />
        <Button onClick={openCreateClientDrawer} size="sm">
          <PlusIcon className="mr-2 h-4 w-4" />
          Create Client
        </Button>
      </div>
      {clientsCount === 0 && !searchString ? (
        <div className="flex flex-col items-center justify-center space-y-5 rounded-lg border px-48 py-12 shadow-sm">
          <div className="flex flex-col space-y-1">
            <h3 className="text-center font-medium text-foreground text-lg">
              No OAuth2 Clients
            </h3>
            <p className="text-center text-muted-foreground text-sm">
              Create your first OAuth2 client to get started.
            </p>
          </div>
          <Button onClick={openCreateClientDrawer}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Create Client
          </Button>
        </div>
      ) : (
        <div className="grid grid-flow-row gap-2 lg:w-9xl">
          <div className="grid h-full w-full grid-flow-row overflow-hidden pb-4">
            <div className="grid w-full border-b p-2 md:grid-cols-8">
              <p className="font-medium text-foreground md:col-span-2">
                Client ID
              </p>
              <p className="hidden font-medium text-foreground md:block">
                Type
              </p>
              <p className="hidden font-medium text-foreground md:block">
                Created
              </p>
              <p className="col-span-3 hidden font-medium text-foreground md:block">
                Scopes
              </p>
            </div>
            {clientsCount === 0 && searchString && (
              <div className="flex flex-col items-center justify-center space-y-5 border-x border-b px-48 py-12">
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
            {clients.length > 0 && (
              <div className="grid grid-flow-row gap-4">
                <OAuth2ClientsList
                  clients={clients}
                  onRefetch={() => refetchClients()}
                />
                <Pagination
                  className="px-2"
                  totalNrOfPages={nrOfPages}
                  currentPageNumber={currentPage}
                  totalNrOfElements={totalNrOfElements}
                  itemsLabel="clients"
                  elementsPerPage={ELEMENTS_PER_PAGE}
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

OAuth2ClientsPage.getLayout = function getLayout(page: ReactElement) {
  return <OrgLayout>{page}</OrgLayout>;
};
