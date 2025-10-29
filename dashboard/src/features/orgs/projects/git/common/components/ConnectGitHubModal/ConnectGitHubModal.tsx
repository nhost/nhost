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
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useGetAuthUserProvidersQuery } from '@/generated/graphql';
import { useAccessToken } from '@/hooks/useAccessToken';
import { listGitHubInstallationRepos } from '@/lib/github';
import { nhost } from '@/utils/nhost';
import { Divider } from '@mui/material';
import debounce from 'lodash.debounce';
import NavLink from 'next/link';
import type { ChangeEvent } from 'react';
import { Fragment, useEffect, useMemo, useState } from 'react';

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
  const [ConnectGitHubModalState, setConnectGitHubModalState] =
    useState<ConnectGitHubModalState>('CONNECTING');
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [githubData, setGithubData] = useState<GitHubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { project, loading: loadingProject } = useProject();
  const { org, loading: loadingOrg } = useCurrentOrg();
  const hostname = useHostName();
  const token = useAccessToken();
  const {
    data,
    loading: loadingGithubConnected,
    error: errorGithubConnected,
  } = useGetAuthUserProvidersQuery();
  const isGithubConnected = data?.authUserProviders?.some(
    (item) => item.providerId === 'github',
  );

  const github = useMemo(
    () => {
      if (typeof window !== 'undefined') {
        return nhost.auth.signInProviderURL('github', {
          connect: token,
          redirectTo: `${window.location.origin}?signinProvider=github&state=signin-refresh:${org.slug}:${project!.subdomain}`,
        });
      }
      return '';
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token],
  );

  useEffect(() => {
    if (loadingGithubConnected) {
      return;
    }

    const fetchGitHubData = async () => {
      try {
        setLoading(true);

        if (!isGithubConnected) {
          setConnectGitHubModalState('GITHUB_CONNECTION_REQUIRED');
          setLoading(false);
          return;
        }

        // Get stored GitHub provider tokens from localStorage
        const storedTokens = localStorage.getItem(
          'nhost_provider_tokens_github',
        );
        if (!storedTokens) {
          setConnectGitHubModalState('EXPIRED_GITHUB_SESSION');
          setLoading(false);
          return;
        }

        const parsedTokens = JSON.parse(storedTokens);
        const { refreshToken, expiresAt } = parsedTokens;
        let accessToken = parsedTokens?.accessToken;

        const currentTime = Date.now();
        const marginSeconds = 60;
        if (expiresAt - currentTime < marginSeconds * 1000) {
          if (!refreshToken) {
            setConnectGitHubModalState('EXPIRED_GITHUB_SESSION');
            setLoading(false);
            return;
          }

          // Refresh the GitHub provider token
          const refreshResponse = await nhost.auth.refreshProviderToken(
            'github',
            { refreshToken },
          );

          if (!refreshResponse.body) {
            // If no tokens found or refresh failed, show GitHub sign-in modal
            setConnectGitHubModalState('EXPIRED_GITHUB_SESSION');
            setLoading(false);
            return;
          }

          // Save the new tokens to localStorage
          localStorage.setItem(
            'nhost_provider_tokens_github',
            JSON.stringify(refreshResponse.body),
          );

          accessToken = refreshResponse.body.accessToken;
        }

        // Fetch GitHub installations and repositories with the new access token
        const installations = await listGitHubInstallationRepos(accessToken);

        // Transform the data to match the expected format
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
        setError(err as Error);
        setLoading(false);
      }
    };

    fetchGitHubData();
  }, [isGithubConnected, loadingGithubConnected]);

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

  if (error) {
    throw error;
  }

  if (errorGithubConnected instanceof Error) {
    throw errorGithubConnected;
  }

  if (loading || loadingProject || loadingOrg || loadingGithubConnected) {
    return (
      <div className="w-[653px] px-1">
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

  if (ConnectGitHubModalState === 'GITHUB_CONNECTION_REQUIRED') {
    return (
      <div className="grid grid-flow-row justify-center gap-4 p-0.5">
        <p className="text-center text-foreground">
          You need to connect your GitHub account to continue.
        </p>
        <NavLink
          href={github}
          passHref
          rel="noreferrer noopener"
          legacyBehavior
        >
          <Button
            className=""
            variant="outlined"
            color="secondary"
            startIcon={<GitHubIcon />}
          >
            Connect with GitHub
          </Button>
        </NavLink>
      </div>
    );
  }

  if (ConnectGitHubModalState === 'EXPIRED_GITHUB_SESSION') {
    return (
      <div className="grid grid-flow-row justify-center gap-2 p-0.5">
        <p className="text-center text-foreground">
          Your session has expired. Please sign in with GitHub to continue.
        </p>
        <GithubAuthButton
          redirectTo={`${hostname}?signinProvider=github&state=signin-refresh:${org.slug}:${project!.subdomain}`}
          buttonText="Sign in with GitHub"
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
        connectGithubModalState={ConnectGitHubModalState}
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
