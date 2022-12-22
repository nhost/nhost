import { CheckGithubConfiguration } from '@/components/applications/github/CheckGithubConfiguration';
import { EditRepositorySettings } from '@/components/applications/github/EditRepositorySettings';
import GitHubInstallNhostApplication from '@/components/applications/github/GitHubInstallNhostApplication';
// ConnectGitHubModal and EditRepositorySettings form a dependency cycle which
// needs to be fixed
// eslint-disable-next-line import/no-cycle
import { Repo } from '@/components/applications/github/Repo';
import RetryableErrorBoundary from '@/components/common/RetryableErrorBoundary';
import GithubIcon from '@/components/icons/GithubIcon';
import { useGetGithubRepositoriesQuery } from '@/generated/graphql';
import DelayedLoading from '@/ui/DelayedLoading/DelayedLoading';
import { Text } from '@/ui/Text';
import Input from '@/ui/v2/Input';
import debounce from 'lodash.debounce';
import type { ChangeEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
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
    return <DelayedLoading delay={500} />;
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
            <GithubIcon className="h-8 w-8 text-greyscaleDark" />
          </div>
        </div>
        {noRepositoriesAdded ? (
          <GitHubNoRepositoriesAdded
            filteredGitHubAppInstallations={filteredGitHubAppInstallations}
          />
        ) : (
          <div>
            <div>
              <Text
                variant="subHeading"
                color="greyscaleDark"
                size="large"
                className="mt-2.5 text-center"
              >
                Connect repository
              </Text>
              <Text
                variant="body"
                color="greyscaleDark"
                size="tiny"
                className="text-center font-normal"
              >
                Showing repositories from{' '}
                <span className="">{data.githubAppInstallations.length}</span>{' '}
                GitHub account(s)
              </Text>
              <div className="mt-6 flex w-full">
                <Input
                  placeholder="Search..."
                  onChange={handleFilterChange}
                  fullWidth
                  autoFocus
                />
              </div>
            </div>
            <RetryableErrorBoundary>
              <div className="h-import  divide-y-1 divide-divide overflow-y-auto border-t-1 border-b-1">
                {githubRepositoriesToDisplay.map((repo) => (
                  <Repo
                    key={repo.id}
                    repo={repo}
                    setSelectedRepoId={() => setSelectedRepoId(repo.id)}
                  />
                ))}
              </div>
            </RetryableErrorBoundary>
          </div>
        )}
        {!noRepositoriesAdded && <CheckGithubConfiguration />}
      </div>
    </div>
  );
}
