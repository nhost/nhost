import { SiGithub as GitHubIcon } from '@icons-pack/react-simple-icons';
import debounce from 'lodash.debounce';
import {
  ExternalLink as ArrowSquareOutIcon,
  CirclePlus as PlusCircleIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { ChangeEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { Avatar } from '@/components/ui/v3/avatar';
import { Button } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import { Spinner } from '@/components/ui/v3/spinner';
import { GithubAuthButton } from '@/features/auth/AuthProviders/Github/GithubAuthButton';
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
import { appendPkceId, generateAndStorePKCE } from '@/lib/pkce';
import { isEmptyValue } from '@/lib/utils';
import { getToastStyleProps } from '@/utils/constants/settings';
import { nhost } from '@/utils/nhost';

export type ConnectGitHubModalState =
  | 'CONNECTING'
  | 'EDITING'
  | 'EXPIRED_GITHUB_SESSION'
  | 'GITHUB_CONNECTION_REQUIRED';

export interface ConnectGitHubModalProps {
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

function GitHubModalHeader({
  title,
  description,
}: {
  title: string;
  description?: ReactNode;
}) {
  return (
    <div className="flex flex-col text-center">
      <div className="mx-auto h-8 w-8">
        <GitHubIcon className="h-8 w-8" />
      </div>
      <h2 className="mt-2.5 font-medium text-lg">{title}</h2>
      {description ? (
        <p className="font-normal text-muted-foreground text-xs">
          {description}
        </p>
      ) : null}
    </div>
  );
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

  async function handleConnectGitHub() {
    const { challenge, id } = await generateAndStorePKCE();
    const url = nhost.auth.signInProviderURL('github', {
      connect: token,
      redirectTo: appendPkceId(
        `${window.location.origin}?signinProvider=github&state=signin-refresh:${org.slug}:${project?.subdomain}`,
        id,
      ),
      codeChallenge: challenge,
    });
    window.location.href = url;
  }

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

        const errorMessage =
          err instanceof Error
            ? err.message
            : 'An error occurred while fetching GitHub data.';
        toast.error(errorMessage, getToastStyleProps());
        close?.();
      }
    };

    fetchGitHubData();
  }, [githubProvider, loadingGithubConnected, close]);

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

  const renderContent = () => {
    if (errorGithubConnected instanceof Error) {
      return (
        <div className="px-1">
          <div className="flex flex-col gap-2">
            <GitHubModalHeader title="Error fetching GitHub data" />
            <Alert variant="destructive">
              <AlertDescription>
                {errorGithubConnected.message}
              </AlertDescription>
            </Alert>
          </div>
        </div>
      );
    }

    if (loading || loadingProject || loadingOrg || loadingGithubConnected) {
      return (
        <div className="px-1">
          <div className="flex flex-col">
            <GitHubModalHeader
              title="Loading repositories..."
              description="Fetching your GitHub repositories"
            />
            <div className="mt-6 mb-2 flex w-full">
              <Input
                placeholder="Search..."
                disabled
                wrapperClassName="w-full"
              />
            </div>
            <div className="flex h-import items-center justify-center border-y">
              <Spinner size="xs" />
            </div>
          </div>
        </div>
      );
    }

    if (connectGitHubModalState === 'GITHUB_CONNECTION_REQUIRED') {
      return (
        <div className="flex flex-col items-center justify-center gap-5 px-1 py-1">
          <p className="text-center text-foreground">
            You need to connect your GitHub account to continue.
          </p>
          <Button
            variant="outline"
            className="flex w-72 max-w-72 gap-2"
            onClick={handleConnectGitHub}
          >
            <GitHubIcon className="h-4 w-4" />
            Connect to GitHub
          </Button>
        </div>
      );
    }

    if (connectGitHubModalState === 'EXPIRED_GITHUB_SESSION') {
      return (
        <div className="flex w-full flex-col items-center justify-center gap-5 px-1 py-1">
          <p className="text-center text-foreground">
            Please sign in with GitHub to continue.
          </p>
          <GithubAuthButton
            redirectTo={`${hostname}?signinProvider=github&state=signin-refresh:${org.slug}:${project!.subdomain}`}
            buttonText="Sign in with GitHub"
            className="!bg-primary !text-white disabled:!text-white disabled:!text-opacity-60 dark:!bg-white dark:!text-black dark:disabled:!text-black w-full max-w-72 gap-2"
          />
        </div>
      );
    }

    if (selectedRepoId !== null) {
      return (
        <EditRepositorySettings
          close={close}
          selectedRepoId={selectedRepoId}
          openConnectGithubModal={() =>
            setConnectGitHubModalState('CONNECTING')
          }
          connectGithubModalState={connectGitHubModalState}
          handleSelectAnotherRepository={handleSelectAnotherRepository}
        />
      );
    }

    const { githubAppInstallations = [], githubRepositories = [] } =
      githubData || {};

    const filteredGitHubAppInstallations = githubAppInstallations.filter(
      (githubApp) => !!githubApp.accountLogin,
    );

    const filteredGitHubRepositories = githubRepositories.filter(
      (repo) => !!repo.githubAppInstallation,
    );

    const filteredGitHubAppInstallationsNullValues =
      filteredGitHubAppInstallations.length === 0;

    const faultyGitHubInstallation =
      githubAppInstallations.length === 0 ||
      filteredGitHubAppInstallationsNullValues;

    const noRepositoriesAdded = githubRepositories.length === 0;

    if (faultyGitHubInstallation) {
      return (
        <div className="grid grid-flow-row justify-center gap-2 p-0.5">
          <GitHubIcon className="mx-auto h-8 w-8" />

          <div className="text-center">
            <h2 className="font-semibold text-lg">
              Install the Nhost GitHub Application
            </h2>

            <p className="text-muted-foreground text-sm">
              Install the Nhost application on your GitHub account and update
              permissions to automatically track repositories.
            </p>
          </div>

          <Button asChild>
            <Link
              href={`${process.env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL}?state=install-github-app:${org.slug}:${project!.subdomain}`}
              rel="noreferrer noopener"
            >
              Configure the Nhost application on GitHub
              <ArrowSquareOutIcon className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      );
    }

    const githubRepositoriesToDisplay = filter
      ? filteredGitHubRepositories.filter((repo) =>
          repo.fullName.toLowerCase().includes(filter.toLowerCase()),
        )
      : filteredGitHubRepositories;

    return (
      <div className="px-1">
        <div className="flex flex-col">
          {noRepositoriesAdded ? (
            <div>
              <GitHubModalHeader title="No repositories found" />

              <p className="text-center text-muted-foreground text-xs">
                Check the Nhost app&apos;s settings on your GitHub account, or
                install the app on a new account.
              </p>

              <ul className="my-2 divide-y divide-border border-y">
                {filteredGitHubAppInstallations.map((githubApp) => (
                  <li
                    key={githubApp.id}
                    className="grid grid-flow-col items-center justify-start gap-2 py-2.5"
                  >
                    <Avatar
                      src={githubApp.accountAvatarUrl}
                      name={githubApp.accountLogin}
                      className="mr-1 h-5 w-5"
                    />
                    <span className="font-medium text-sm">
                      {githubApp.accountLogin}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={`${process.env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL}?state=install-github-app:${org.slug}:${project!.subdomain}`}
                rel="noreferrer noopener"
                className="grid grid-flow-col items-center justify-start gap-1 text-primary hover:underline"
              >
                <PlusCircleIcon className="h-4 w-4" />
                Configure the Nhost application on GitHub.
              </Link>
            </div>
          ) : (
            <div>
              <GitHubModalHeader
                title="Connect repository"
                description={`Showing repositories from ${githubAppInstallations.length} GitHub account(s)`}
              />
              <div className="mt-6 mb-2 flex w-full">
                <Input
                  placeholder="Search..."
                  onChange={handleFilterChange}
                  wrapperClassName="w-full"
                  autoFocus
                />
              </div>
              <RetryableErrorBoundary errorMessageProps={{ className: 'p-1' }}>
                {githubRepositoriesToDisplay.length === 0 ? (
                  <div className="h-import py-2">
                    <p className="text-muted-foreground text-sm">
                      No results found.
                    </p>
                  </div>
                ) : (
                  <ul className="h-import divide-y divide-border overflow-y-auto border-y">
                    {githubRepositoriesToDisplay.map((repo) => (
                      <li
                        key={repo.id}
                        className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 py-2.5"
                      >
                        <Avatar
                          alt={repo.githubAppInstallation.accountLogin}
                          src={repo.githubAppInstallation.accountAvatarUrl}
                          name={repo.githubAppInstallation.accountLogin}
                          className="h-8 w-8"
                        />
                        <div className="grid min-w-0 gap-0.5">
                          <span className="truncate font-medium text-sm">
                            {repo.name}
                          </span>
                          <span className="truncate text-muted-foreground text-xs">
                            {repo.githubAppInstallation.accountLogin}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          onClick={() => setSelectedRepoId(repo.node_id)}
                        >
                          Connect
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </RetryableErrorBoundary>
            </div>
          )}

          {!noRepositoriesAdded && (
            <p className="mt-2 text-center text-xs">
              Do you miss a repository, or do you need to connect another GitHub
              account?{' '}
              <Link
                href={`${process.env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL}?state=install-github-app:${org.slug}:${project!.subdomain}`}
                rel="noreferrer noopener"
                className="font-medium text-primary text-xs hover:underline"
              >
                Manage your GitHub configuration
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    );
  };

  return <div className="md:w-[653px]">{renderContent()}</div>;
}
