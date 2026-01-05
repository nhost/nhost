import { ErrorMessage } from '@/components/presentational/ErrorMessage';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Avatar } from '@/components/ui/v2/Avatar';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { ArrowSquareOutIcon } from '@/components/ui/v2/icons/ArrowSquareOutIcon';
import { GitHubIcon } from '@/components/ui/v2/icons/GitHubIcon';
import { PlusCircleIcon } from '@/components/ui/v2/icons/PlusCircleIcon';
import { Input } from '@/components/ui/v2/Input';
import { Link } from '@/components/ui/v2/Link';
import { List } from '@/components/ui/v2/List';
import { ListItem } from '@/components/ui/v2/ListItem';
import { Text } from '@/components/ui/v2/Text';
import { GithubAuthButton } from '@/features/auth/AuthProviders/Github/components/GithubAuthButton';
import { useHostName } from '@/features/orgs/projects/common/hooks/useHostName';
import { EditRepositorySettings } from '@/features/orgs/projects/git/common/components/EditRepositorySettings';
import {
  getGitHubToken,
  saveGitHubToken,
} from '@/features/orgs/projects/git/common/utils';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useGetAuthUserProvidersQuery } from '@/generated/graphql';
import { useAccessToken } from '@/hooks/useAccessToken';
import { GitHubAPIError, listGitHubInstallationRepos } from '@/lib/github';
import { isEmptyValue } from '@/lib/utils';
import { getToastStyleProps } from '@/utils/constants/settings';
import { nhost } from '@/utils/nhost';
import { Divider } from '@mui/material';
import debounce from 'lodash.debounce';
import NavLink from 'next/link';
import type { ChangeEvent } from 'react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

export type ConnectGitHubModalState =
  | 'CONNECTING'
  | 'EDITING'
  | 'EXPIRED_GITHUB_SESSION'
  | 'GITHUB_CONNECTION_REQUIRED';

export interface ConnectGitHubModalProps {
  /**
   * You can pass a custom function to close the current modal if it was mounted on an a parent component (e.g. <Modal></Modal>)
   * (that is, a one off modal rendered on the parent component). This will be removed completely when we fully move to the new Dialogs.
   */
  close?: VoidFunction;
}

interface GitHubData {
  githubAppInstallations: Array<{
    id: number;
    accountLogin?: string;
    accountAvatarUrl?: string;
  }>;
  githubRepositories: Array<{
    id: number;
    node_id: string;
    name: string;
    fullName: string;
    githubAppInstallation: {
      accountLogin?: string;
      accountAvatarUrl?: string;
    };
  }>;
}

export default function ConnectGitHubModal({ close }: ConnectGitHubModalProps) {
  const [filter, setFilter] = useState('');
  const [connectGitHubModalState, setConnectGitHubModalState] =
    useState<ConnectGitHubModalState>('CONNECTING');
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [githubData, setGithubData] = useState<GitHubData | null>(null);
  const [loading, setLoading] = useState(true);
  const { project, loading: loadingProject } = useProject();
  const { org, loading: loadingOrg } = useCurrentOrg();
  const hostname = useHostName();
  const token = useAccessToken();
  const {
    data,
    loading: loadingGithubConnected,
    error: errorGithubConnected,
  } = useGetAuthUserProvidersQuery();

  const githubProvider = data?.authUserProviders?.find(
    (item) => item.providerId === 'github',
  );

  const getGitHubConnectUrl = () => {
    if (typeof window !== 'undefined') {
      return nhost.auth.signInProviderURL('github', {
        connect: token,
        redirectTo: `${window.location.origin}?signinProvider=github&state=signin-refresh:${org.slug}:${project?.subdomain}`,
      });
    }
    return '';
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: close does the same thing every render
  useEffect(() => {
    if (loadingGithubConnected) {
      return;
    }

    const fetchGitHubData = async () => {
      try {
        setLoading(true);

        if (isEmptyValue(githubProvider)) {
          setConnectGitHubModalState('GITHUB_CONNECTION_REQUIRED');
          setLoading(false);
          return;
        }
        const githubToken = getGitHubToken();

        if (
          !githubToken?.authUserProviderId ||
          githubProvider!.id !== githubToken.authUserProviderId
        ) {
          setConnectGitHubModalState('EXPIRED_GITHUB_SESSION');
          setLoading(false);
          return;
        }

        const { refreshToken, expiresAt: expiresAtString } = githubToken;
        let accessToken = githubToken?.accessToken;

        const expiresAt = new Date(expiresAtString).getTime();

        const currentTime = Date.now();
        const expiresAtMargin = 60 * 1000;
        if (expiresAt - currentTime < expiresAtMargin) {
          if (!refreshToken) {
            setConnectGitHubModalState('EXPIRED_GITHUB_SESSION');
            setLoading(false);
            return;
          }

          const refreshResponse = await nhost.auth.refreshProviderToken(
            'github',
            { refreshToken },
          );

          if (!refreshResponse.body) {
            setConnectGitHubModalState('EXPIRED_GITHUB_SESSION');
            setLoading(false);
            return;
          }

          saveGitHubToken({
            ...refreshResponse.body,
            authUserProviderId: githubProvider!.id,
          });

          accessToken = refreshResponse.body.accessToken;
        }

        const installations = await listGitHubInstallationRepos(accessToken);

        const transformedData = {
          githubAppInstallations: installations.map((item) => ({
            id: item.installation.id,
            accountLogin: item.installation.account?.login,
            accountAvatarUrl: item.installation.account?.avatar_url,
          })),
          githubRepositories: installations.flatMap((item) =>
            item.repositories.map((repo) => ({
              id: repo.id,
              node_id: repo.node_id,
              name: repo.name,
              fullName: repo.full_name,
              githubAppInstallation: {
                accountLogin: item.installation.account?.login,
                accountAvatarUrl: item.installation.account?.avatar_url,
              },
            })),
          ),
        };

        setGithubData(transformedData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching GitHub data:', err);
        if (err instanceof GitHubAPIError && err.status === 401) {
          setConnectGitHubModalState('EXPIRED_GITHUB_SESSION');
          setLoading(false);
          return;
        }

        toast.error(err?.message, getToastStyleProps());
        close?.();
      }
    };

    fetchGitHubData();
  }, [githubProvider, loadingGithubConnected]);

  const handleSelectAnotherRepository = () => {
    setSelectedRepoId(null);
    setConnectGitHubModalState('CONNECTING');
  };

  const handleFilterChange = useMemo(
    () =>
      debounce((event: ChangeEvent<HTMLInputElement>) => {
        setFilter(event.target.value);
      }, 200),
    [],
  );

  useEffect(() => () => handleFilterChange.cancel(), [handleFilterChange]);

  if (errorGithubConnected instanceof Error) {
    return (
      <div className="px-1 md:w-[653px]">
        <div className="flex flex-col">
          <div className="mx-auto text-center">
            <div className="mx-auto h-8 w-8">
              <GitHubIcon className="h-8 w-8" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Text className="mt-2.5 text-center text-lg font-medium">
              Error fetching GitHub data
            </Text>
            <ErrorMessage>{errorGithubConnected.message}</ErrorMessage>
          </div>
        </div>
      </div>
    );
  }

  if (loading || loadingProject || loadingOrg || loadingGithubConnected) {
    return (
      <div className="px-1 md:w-[653px]">
        <div className="flex flex-col">
          <div className="mx-auto text-center">
            <div className="mx-auto h-8 w-8">
              <GitHubIcon className="h-8 w-8" />
            </div>
          </div>
          <div>
            <Text className="mt-2.5 text-center text-lg font-medium">
              Loading repositories...
            </Text>
            <Text className="text-center text-xs font-normal" color="secondary">
              Fetching your GitHub repositories
            </Text>
            <div className="mb-2 mt-6 flex w-full">
              <Input placeholder="Search..." fullWidth disabled value="" />
            </div>
          </div>
          <div className="flex h-import items-center justify-center border-y">
            <ActivityIndicator delay={0} label="" />
          </div>
        </div>
      </div>
    );
  }

  if (connectGitHubModalState === 'GITHUB_CONNECTION_REQUIRED') {
    return (
      <div className="flex flex-col items-center justify-center gap-5 px-1 py-1 md:w-[653px]">
        <p className="text-center text-foreground">
          You need to connect your GitHub account to continue.
        </p>
        <NavLink
          href={getGitHubConnectUrl()}
          passHref
          rel="noreferrer noopener"
          legacyBehavior
        >
          <Button
            className="w-full max-w-72"
            variant="outlined"
            color="secondary"
            startIcon={<GitHubIcon />}
          >
            Connect to GitHub
          </Button>
        </NavLink>
      </div>
    );
  }

  if (connectGitHubModalState === 'EXPIRED_GITHUB_SESSION') {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-5 px-1 py-1 md:w-[653px]">
        <p className="text-center text-foreground">
          Please sign in with GitHub to continue.
        </p>
        <GithubAuthButton
          redirectTo={`${hostname}?signinProvider=github&state=signin-refresh:${org.slug}:${project!.subdomain}`}
          buttonText="Sign in with GitHub"
          className="w-full max-w-72 gap-2 !bg-primary !text-white disabled:!text-white disabled:!text-opacity-60 dark:!bg-white dark:!text-black dark:disabled:!text-black"
        />
      </div>
    );
  }

  if (selectedRepoId !== null) {
    return (
      <EditRepositorySettings
        close={close}
        selectedRepoId={selectedRepoId}
        openConnectGithubModal={() => setConnectGitHubModalState('CONNECTING')}
        connectGithubModalState={connectGitHubModalState}
        handleSelectAnotherRepository={handleSelectAnotherRepository}
      />
    );
  }

  const { githubAppInstallations } = githubData || {};

  const filteredGitHubAppInstallations =
    githubData?.githubAppInstallations.filter(
      (githubApp) => !!githubApp.accountLogin,
    );

  const filteredGitHubRepositories = githubData?.githubRepositories.filter(
    (repo) => !!repo.githubAppInstallation,
  );

  const filteredGitHubAppInstallationsNullValues =
    githubData?.githubAppInstallations.filter(
      (githubApp) => !!githubApp.accountLogin,
    ).length === 0;

  const faultyGitHubInstallation =
    githubAppInstallations?.length === 0 ||
    filteredGitHubAppInstallationsNullValues;

  const noRepositoriesAdded = githubData?.githubRepositories.length === 0;

  if (faultyGitHubInstallation) {
    return (
      <div className="grid grid-flow-row justify-center gap-2 p-0.5">
        <GitHubIcon className="mx-auto h-8 w-8" />

        <div className="text-center">
          <Text variant="h3" component="h2">
            Install the Nhost GitHub Application
          </Text>

          <Text variant="subtitle2">
            Install the Nhost application on your GitHub account and update
            permissions to automatically track repositories.
          </Text>
        </div>

        <Button
          href={`${process.env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL}?state=install-github-app:${org.slug}:${project!.subdomain}`}
          rel="noreferrer noopener"
          endIcon={<ArrowSquareOutIcon className="h-4 w-4" />}
        >
          Configure the Nhost application on GitHub
        </Button>
      </div>
    );
  }

  const githubRepositoriesToDisplay = filter
    ? filteredGitHubRepositories?.filter((repo) =>
        repo.fullName.toLowerCase().includes(filter.toLowerCase()),
      )
    : filteredGitHubRepositories;

  return (
    <div className="px-1">
      <div className="flex flex-col">
        <div className="mx-auto text-center">
          <div className="mx-auto h-8 w-8">
            <GitHubIcon className="h-8 w-8" />
          </div>
        </div>
        {noRepositoriesAdded ? (
          <div>
            <Text className="mt-1 text-center text-lg font-medium">
              No repositories found
            </Text>

            <Text className="text-center text-xs">
              Check the Nhost app&apos;s settings on your GitHub account, or
              install the app on a new account.
            </Text>

            <List className="my-2 border-y">
              {filteredGitHubAppInstallations?.map((githubApp, index) => (
                <Fragment key={githubApp.id}>
                  <ListItem.Root
                    key={githubApp.id}
                    className="grid grid-flow-col items-center justify-start gap-2 py-2.5"
                  >
                    <ListItem.Avatar>
                      <Avatar
                        src={githubApp.accountAvatarUrl as string}
                        className="mr-1 h-5 w-5"
                      />
                    </ListItem.Avatar>

                    <ListItem.Text primary={githubApp.accountLogin} />
                  </ListItem.Root>

                  {index < filteredGitHubAppInstallations.length - 1 && (
                    <Divider component="li" />
                  )}
                </Fragment>
              ))}
            </List>

            <Link
              href={`${process.env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL}?state=install-github-app:${org.slug}:${project!.subdomain}`}
              rel="noreferrer noopener"
              underline="hover"
              className="grid grid-flow-col items-center justify-start gap-1"
            >
              <PlusCircleIcon className="h-4 w-4" />
              Configure the Nhost application on GitHub.
            </Link>
          </div>
        ) : (
          <div>
            <div>
              <Text className="mt-2.5 text-center text-lg font-medium">
                Connect repository
              </Text>
              <Text
                className="text-center text-xs font-normal"
                color="secondary"
              >
                Showing repositories from{' '}
                {githubData?.githubAppInstallations.length} GitHub account(s)
              </Text>
              <div className="mb-2 mt-6 flex w-full">
                <Input
                  placeholder="Search..."
                  onChange={handleFilterChange}
                  fullWidth
                  autoFocus
                />
              </div>
            </div>
            <RetryableErrorBoundary>
              {githubRepositoriesToDisplay?.length === 0 ? (
                <Box className="h-import py-2">
                  <Text variant="subtitle2">No results found.</Text>
                </Box>
              ) : (
                <List className="h-import overflow-y-auto border-y">
                  {githubRepositoriesToDisplay?.map((repo, index) => (
                    <Fragment key={repo.id}>
                      <ListItem.Root
                        className="grid grid-flow-col justify-start gap-2 py-2.5"
                        secondaryAction={
                          <Button
                            variant="borderless"
                            color="primary"
                            onClick={() => setSelectedRepoId(repo.node_id)}
                          >
                            Connect
                          </Button>
                        }
                      >
                        <ListItem.Avatar>
                          <Avatar
                            alt={
                              repo.githubAppInstallation.accountLogin as string
                            }
                            src={
                              repo.githubAppInstallation
                                .accountAvatarUrl as string
                            }
                            className="h-8 w-8"
                          >
                            {repo.githubAppInstallation.accountLogin}
                          </Avatar>
                        </ListItem.Avatar>
                        <ListItem.Text
                          primary={repo.name}
                          secondary={repo.githubAppInstallation.accountLogin}
                        />
                      </ListItem.Root>

                      {index < githubRepositoriesToDisplay.length - 1 && (
                        <Divider component="li" />
                      )}
                    </Fragment>
                  ))}
                </List>
              )}
            </RetryableErrorBoundary>
          </div>
        )}

        {!noRepositoriesAdded && (
          <Text className="mt-2 text-center text-xs">
            Do you miss a repository, or do you need to connect another GitHub
            account?{' '}
            <Link
              href={`${process.env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL}?state=install-github-app:${org.slug}:${project!.subdomain}`}
              rel="noreferrer noopener"
              className="text-xs font-medium"
              underline="hover"
            >
              Manage your GitHub configuration
            </Link>
            .
          </Text>
        )}
      </div>
    </div>
  );
}
