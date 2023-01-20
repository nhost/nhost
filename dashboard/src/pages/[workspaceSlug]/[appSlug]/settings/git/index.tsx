import useGitHubModal from '@/components/applications/github/useGitHubModal';
import { useDialog } from '@/components/common/DialogProvider';
import GithubIcon from '@/components/icons/GithubIcon';
import Container from '@/components/layout/Container';
import BaseDirectorySettings from '@/components/settings/git/BaseDirectorySettings';
import DeploymentBranchSettings from '@/components/settings/git/DeploymentBranchSettings';
import SettingsContainer from '@/components/settings/SettingsContainer';
import SettingsLayout from '@/components/settings/SettingsLayout';
import { useUpdateAppMutation } from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Text from '@/ui/v2/Text';
import { triggerToast } from '@/utils/toast';
import { updateOwnCache } from '@/utils/updateOwnCache';
import { useApolloClient } from '@apollo/client';
import type { ReactElement } from 'react';

export default function SettingsGitPage() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const { openGitHubModal } = useGitHubModal();
  const { openAlertDialog } = useDialog();
  const client = useApolloClient();

  const [updateApp] = useUpdateAppMutation();

  return (
    <Container
      className="grid max-w-5xl grid-flow-row gap-y-6 bg-transparent"
      rootClassName="bg-transparent"
    >
      <SettingsContainer
        title="Git Repository"
        description="Create Deployments for commits pushed to your Git repository."
        docsLink="https://docs.nhost.io/platform/github-integration"
        slotProps={{ submitButton: { className: 'hidden' } }}
        className="grid grid-cols-5"
      >
        {!currentApplication.githubRepository ? (
          <Button
            onClick={openGitHubModal}
            className="col-span-5 grid grid-flow-col gap-1.5 xs:col-span-3 lg:col-span-2"
            startIcon={<GithubIcon className="h-4 w-4 self-center" />}
          >
            Connect to GitHub
          </Button>
        ) : (
          <Box className="col-span-5 flex flex-row place-content-between items-center rounded-lg border px-4 py-4">
            <div className="ml-2 flex flex-row">
              <GithubIcon className="mr-1.5 h-7 w-7 self-center" />
              <Text className="self-center font-normal">
                {currentApplication.githubRepository.fullName}
              </Text>
            </div>
            <Button
              variant="borderless"
              onClick={() => {
                openAlertDialog({
                  title: 'Disconnect GitHub Repository',
                  payload: (
                    <p>
                      Are you sure you want to disconnect{' '}
                      <b>{currentApplication.githubRepository.fullName}</b>?
                    </p>
                  ),
                  props: {
                    primaryButtonText: 'Disconnect GitHub Repository',
                    primaryButtonColor: 'error',
                    onPrimaryAction: async () => {
                      await updateApp({
                        variables: {
                          id: currentApplication.id,
                          app: {
                            githubRepositoryId: null,
                          },
                        },
                      });
                      triggerToast(
                        `Successfully disconnected GitHub repository from ${currentApplication.name}.`,
                      );
                      await updateOwnCache(client);
                    },
                  },
                });
              }}
            >
              Disconnect
            </Button>
          </Box>
        )}
      </SettingsContainer>
      <DeploymentBranchSettings />
      <BaseDirectorySettings />
    </Container>
  );
}

SettingsGitPage.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};
