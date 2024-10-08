import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Avatar } from '@/components/ui/v1/Avatar';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
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
import { EditRepositorySettings } from '@/features/orgs/projects/git/common/components/EditRepositorySettings';
import { useGetGithubRepositoriesQuery } from '@/generated/graphql';
import { Divider } from '@mui/material';
import debounce from 'lodash.debounce';
import type { ChangeEvent } from 'react';
import { Fragment, useEffect, useMemo, useState } from 'react';

export type ConnectGitHubModalState = 'CONNECTING' | 'EDITING';

export interface ConnectGitHubModalProps {
  /**
   * You can pass a custom function to close the current modal if it was mounted on an a parent component (e.g. <Modal></Modal>)
   * (that is, a one off modal rendered on the parent component). This will be removed completely when we fully move to the new Dialogs.
   */
  close?: VoidFunction;
}

export default function ConnectGitHubModal({ close }: ConnectGitHubModalProps) {
  const [filter, setFilter] = useState('');
  const [ConnectGitHubModalState, setConnectGitHubModalState] =
    useState<ConnectGitHubModalState>('CONNECTING');
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);

  const { data, loading, error, startPolling } =
    useGetGithubRepositoriesQuery();

  useEffect(() => {
    startPolling(2000);
  }, [startPolling]);

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

  if (loading) {
    return (
      <ActivityIndicator delay={500} label="Loading GitHub repositories..." />
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

  const { githubAppInstallations } = data;

  const filteredGitHubAppInstallations = data.githubAppInstallations.filter(
    (githubApp) => !!githubApp.accountLogin,
  );

  const filteredGitHubRepositories = data.githubRepositories.filter(
    (repo) => !!repo.githubAppInstallation,
  );

  const filteredGitHubAppInstallationsNullValues =
    data.githubAppInstallations.filter((githubApp) => !!githubApp.accountLogin)
      .length === 0;

  const faultyGitHubInstallation =
    githubAppInstallations.length === 0 ||
    filteredGitHubAppInstallationsNullValues;

  const noRepositoriesAdded = data.githubRepositories.length === 0;

  if (faultyGitHubInstallation) {
    return (
      <div className="grid grid-flow-row justify-center gap-2 p-0.5">
        <GitHubIcon className="w-8 h-8 mx-auto" />

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
          href={process.env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL}
          // Both `target` and `rel` are available when `href` is set. This is
          // a limitation of MUI.
          // @ts-ignore
          target="_blank"
          rel="noreferrer noopener"
          endIcon={<ArrowSquareOutIcon className="w-4 h-4" />}
        >
          Configure the Nhost application on GitHub
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
        <div className="mx-auto text-center">
          <div className="w-8 h-8 mx-auto">
            <GitHubIcon className="w-8 h-8" />
          </div>
        </div>
        {noRepositoriesAdded ? (
          <div>
            <Text className="mt-1 text-lg font-medium text-center">
              No repositories found
            </Text>

            <Text className="text-xs text-center">
              Check the Nhost app&apos;s settings on your GitHub account, or
              install the app on a new account.
            </Text>

            <List className="my-2 border-y">
              {filteredGitHubAppInstallations.map((githubApp, index) => (
                <Fragment key={githubApp.id}>
                  <ListItem.Root
                    key={githubApp.id}
                    className="grid grid-flow-col items-center justify-start gap-2 py-2.5"
                  >
                    <ListItem.Avatar>
                      <Avatar
                        avatarUrl={githubApp.accountAvatarUrl as string}
                        className="w-5 h-5 mr-1"
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
              href={process.env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL}
              target="_blank"
              rel="noreferrer noopener"
              underline="hover"
              className="grid items-center justify-start grid-flow-col gap-1"
            >
              <PlusCircleIcon className="w-4 h-4" />
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
                className="text-xs font-normal text-center"
                color="secondary"
              >
                Showing repositories from {data.githubAppInstallations.length}{' '}
                GitHub account(s)
              </Text>
              <div className="flex w-full mt-6 mb-2">
                <Input
                  placeholder="Search..."
                  onChange={handleFilterChange}
                  fullWidth
                  autoFocus
                />
              </div>
            </div>
            <RetryableErrorBoundary>
              {githubRepositoriesToDisplay.length === 0 ? (
                <Box className="py-2 h-import">
                  <Text variant="subtitle2">No results found.</Text>
                </Box>
              ) : (
                <List className="overflow-y-auto h-import border-y">
                  {githubRepositoriesToDisplay.map((repo, index) => (
                    <Fragment key={repo.id}>
                      <ListItem.Root
                        className="grid grid-flow-col justify-start gap-2 py-2.5"
                        secondaryAction={
                          <Button
                            variant="borderless"
                            color="primary"
                            onClick={() => setSelectedRepoId(repo.id)}
                          >
                            Connect
                          </Button>
                        }
                      >
                        <ListItem.Avatar>
                          <Avatar
                            name={repo.githubAppInstallation.accountLogin}
                            avatarUrl={
                              repo.githubAppInstallation.accountAvatarUrl
                            }
                            className="self-center w-8 h-8"
                          />
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
          <Text className="mt-2 text-xs text-center">
            Do you miss a repository, or do you need to connect another GitHub
            account?{' '}
            <Link
              href={process.env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL}
              target="_blank"
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
