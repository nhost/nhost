import debounce from 'lodash.debounce';
import { useRouter } from 'next/router';
import type { ChangeEvent, ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { Pagination } from '@/components/common/Pagination';
import { Container } from '@/components/layout/Container';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Input } from '@/components/ui/v2/Input';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { SearchIcon } from '@/components/ui/v2/icons/SearchIcon';
import { Text } from '@/components/ui/v2/Text';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { MIN_AUTH_VERSION_OAUTH2 } from '@/features/orgs/projects/authentication/oauth2/constants';
import { CreateOAuth2ClientForm } from '@/features/orgs/projects/authentication/oauth2-clients/components/CreateOAuth2ClientForm';
import { OAuth2ClientsList } from '@/features/orgs/projects/authentication/oauth2-clients/components/OAuth2ClientsList';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useSoftwareVersionsInfo } from '@/features/orgs/projects/common/hooks/useSoftwareVersionsInfo';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  useGetOAuth2ClientsQuery,
  useGetOAuth2ProviderSettingsQuery,
} from '@/generated/graphql';
import { isVersionGte } from '@/utils/compareVersions';

const ELEMENTS_PER_PAGE = 25;

export default function OAuth2ClientsPage() {
  const { openDrawer } = useDialog();
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const remoteProjectGQLClient = useRemoteApplicationGQLClient();
  const router = useRouter();
  const { auth, loading: loadingVersions } = useSoftwareVersionsInfo();

  const [searchString, setSearchString] = useState('');
  const [currentPage, setCurrentPage] = useState(
    parseInt(router.query.page as string, 10) || 1,
  );
  const [nrOfPages, setNrOfPages] = useState(1);

  const offset = useMemo(
    () => (currentPage - 1) * ELEMENTS_PER_PAGE,
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

  useEffect(() => {
    if (clientsLoading) {
      return;
    }
    if (totalNrOfElements > 0) {
      setNrOfPages(Math.ceil(totalNrOfElements / ELEMENTS_PER_PAGE));
    } else {
      setNrOfPages(1);
    }
  }, [totalNrOfElements, clientsLoading]);

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
          <ActivityIndicator label="Loading..." />
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
        <Box className="flex flex-col items-center justify-center space-y-5 rounded-lg border px-48 py-12 shadow-sm">
          <div className="flex flex-col space-y-1">
            <Text className="text-center font-medium" variant="h3">
              Auth Version Too Old
            </Text>
            <Text variant="subtitle1" className="text-center">
              OAuth2 Clients require Auth version {MIN_AUTH_VERSION_OAUTH2} or
              later. Please upgrade your Auth service in the Settings page.
            </Text>
          </div>
          <Button
            variant="contained"
            color="primary"
            onClick={() =>
              router.push(
                `/orgs/${router.query.orgSlug}/projects/${router.query.appSubdomain}/settings/authentication`,
              )
            }
          >
            Go to Auth Settings
          </Button>
        </Box>
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
          <ActivityIndicator label="Loading OAuth2 settings..." />
        </div>
      </Container>
    );
  }

  if (settingsError) {
    return (
      <Container className="mx-auto max-w-9xl space-y-5">
        <Alert severity="error">
          <Text className="font-medium">
            Failed to load OAuth2 provider settings. Please try again later.
          </Text>
        </Alert>
      </Container>
    );
  }

  if (!oauth2Enabled) {
    return (
      <Container className="mx-auto max-w-9xl space-y-5">
        <Box className="flex flex-col items-center justify-center space-y-5 rounded-lg border px-48 py-12 shadow-sm">
          <div className="flex flex-col space-y-1">
            <Text className="text-center font-medium" variant="h3">
              OAuth2 Provider is Disabled
            </Text>
            <Text variant="subtitle1" className="text-center">
              Enable the OAuth2 provider in settings to manage OAuth2 clients.
            </Text>
          </div>
          <Button
            variant="contained"
            color="primary"
            onClick={() =>
              router.push(
                `/orgs/${router.query.orgSlug}/projects/${router.query.appSubdomain}/settings/oauth2-provider`,
              )
            }
          >
            Go to OAuth2 Provider Settings
          </Button>
        </Box>
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
            className="rounded-sm"
            placeholder="Search clients"
            startAdornment={
              <SearchIcon
                className="-mr-1 ml-2 h-4 w-4 shrink-0"
                sx={{ color: 'text.disabled' }}
              />
            }
            onChange={handleSearchStringChange}
          />
          <Button
            onClick={openCreateClientDrawer}
            startIcon={<PlusIcon className="h-4 w-4" />}
            size="small"
          >
            Create Client
          </Button>
        </div>
        <div className="flex flex-auto items-center justify-center overflow-hidden">
          <ActivityIndicator label="Loading OAuth2 clients..." />
        </div>
      </Container>
    );
  }

  if (clientsError) {
    return (
      <Container className="mx-auto max-w-9xl space-y-5">
        <Alert severity="error">
          <Text className="font-medium">
            Failed to load OAuth2 clients. Please try again later.
          </Text>
        </Alert>
      </Container>
    );
  }

  const clients = clientsData?.authOauth2Clients ?? [];
  const clientsCount = totalNrOfElements;

  return (
    <Container className="mx-auto max-w-9xl space-y-5 overflow-x-hidden">
      <div className="flex flex-row place-content-between">
        <Input
          className="rounded-sm"
          placeholder="Search clients"
          startAdornment={
            <SearchIcon
              className="-mr-1 ml-2 h-4 w-4 shrink-0"
              sx={{ color: 'text.disabled' }}
            />
          }
          onChange={handleSearchStringChange}
        />
        <Button
          onClick={openCreateClientDrawer}
          startIcon={<PlusIcon className="h-4 w-4" />}
          size="small"
        >
          Create Client
        </Button>
      </div>
      {clientsCount === 0 && !searchString ? (
        <Box className="flex flex-col items-center justify-center space-y-5 rounded-lg border px-48 py-12 shadow-sm">
          <div className="flex flex-col space-y-1">
            <Text className="text-center font-medium" variant="h3">
              No OAuth2 Clients
            </Text>
            <Text variant="subtitle1" className="text-center">
              Create your first OAuth2 client to get started.
            </Text>
          </div>
          <Button
            variant="contained"
            color="primary"
            onClick={openCreateClientDrawer}
            startIcon={<PlusIcon className="h-4 w-4" />}
          >
            Create Client
          </Button>
        </Box>
      ) : (
        <div className="grid grid-flow-row gap-2 lg:w-9xl">
          <div className="grid h-full w-full grid-flow-row overflow-hidden pb-4">
            <Box className="grid w-full border-b p-2 md:grid-cols-8">
              <Text className="font-medium md:col-span-2">Client ID</Text>
              <Text className="hidden font-medium md:block">Type</Text>
              <Text className="hidden font-medium md:block">Created</Text>
              <Text className="col-span-3 hidden font-medium md:block">
                Scopes
              </Text>
            </Box>
            {clientsCount === 0 && searchString && (
              <Box className="flex flex-col items-center justify-center space-y-5 border-x border-b px-48 py-12">
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

OAuth2ClientsPage.getLayout = function getLayout(page: ReactElement) {
  return <OrgLayout>{page}</OrgLayout>;
};
