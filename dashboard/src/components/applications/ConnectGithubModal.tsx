import { CheckGithubConfiguration } from '@/components/applications/github/CheckGithubConfiguration';
import { EditRepositorySettings } from '@/components/applications/github/EditRepositorySettings';
import GitHubInstallNhostApplication from '@/components/applications/github/GitHubInstallNhostApplication';
import RetryableErrorBoundary from '@/components/common/RetryableErrorBoundary';
import GithubIcon from '@/components/icons/GithubIcon';
import { useGetGithubRepositoriesQuery } from '@/generated/graphql';
import { Avatar } from '@/ui/Avatar';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import List from '@/ui/v2/List';
import { ListItem } from '@/ui/v2/ListItem';
import Text from '@/ui/v2/Text';
import { Divider } from '@mui/material';
import debounce from 'lodash.debounce';
import type { ChangeEvent } from 'react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { GitHubNoRepositoriesAdded } from './github/GitHubNoRepositoriesAdded';

export type ConnectGithubModalState = 'CONNECTING' | 'EDITING';

export interface ConnectGithubModalProps {
  /**
   * You can pass a custom function to close the current modal if it was mounted on an a parent component (e.g. <Modal></Modal>)
   * (that is, a one off modal rendered on the parent component). This will be removed completely when we fully move to the new Dialogs.
   */
  close?: VoidFunction;
}

export default function ConnectGithubModal({ close }: ConnectGithubModalProps) {
  const [filter, setFilter] = useState('');
  const [connectGithubModalState, setConnectGithubModalState] =
    useState<ConnectGithubModalState>('CONNECTING');
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);

  const { data, loading, error, startPolling } =
    useGetGithubRepositoriesQuery();

  useEffect(() => {
    startPolling(2000);
  }, [startPolling]);

  const handleSelectAnotherRepository = () => {
    setSelectedRepoId(null);
    setConnectGithubModalState('CONNECTING');
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
        openConnectGithubModal={() => setConnectGithubModalState('CONNECTING')}
        connectGithubModalState={connectGithubModalState}
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
    return <GitHubInstallNhostApplication />;
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
          <div className="mx-auto h-8 w-8">
            <GithubIcon className="h-8 w-8 " />
          </div>
        </div>
        {noRepositoriesAdded ? (
          <GitHubNoRepositoriesAdded
            filteredGitHubAppInstallations={filteredGitHubAppInstallations}
          />
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
                Showing repositories from {data.githubAppInstallations.length}{' '}
                GitHub account(s)
              </Text>
              <div className="mt-6 mb-2 flex w-full">
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
                <Box className="h-import py-2">
                  <Text variant="subtitle2">No results found.</Text>
                </Box>
              ) : (
                <List className="h-import overflow-y-auto border-y">
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
                            className="h-8 w-8 self-center"
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
        {!noRepositoriesAdded && <CheckGithubConfiguration />}
      </div>
    </div>
  );
}
