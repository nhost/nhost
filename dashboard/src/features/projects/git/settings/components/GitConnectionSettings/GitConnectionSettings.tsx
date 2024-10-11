import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { GitHubIcon } from '@/components/ui/v2/icons/GitHubIcon';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useGitHubModal } from '@/features/projects/git/common/hooks/useGitHubModal';
import { triggerToast } from '@/utils/toast';
import { useUpdateApplicationMutation } from '@/utils/__generated__/graphql';

export default function GitConnectionSettings() {
  const { maintenanceActive } = useUI();
  const { currentProject, refetch } = useCurrentWorkspaceAndProject();
  const [updateApp] = useUpdateApplicationMutation();
  const { openAlertDialog } = useDialog();
  const { openGitHubModal } = useGitHubModal();

  function handleConnect() {
    openAlertDialog({
      title: 'Disconnect GitHub Repository',
      payload: (
        <p>
          Are you sure you want to disconnect{' '}
          <b>{currentProject?.githubRepository.fullName}</b>?
        </p>
      ),
      props: {
        primaryButtonText: 'Disconnect GitHub Repository',
        primaryButtonColor: 'error',
        onPrimaryAction: async () => {
          await updateApp({
            variables: {
              appId: currentProject?.id,
              app: {
                githubRepositoryId: null,
              },
            },
          });
          triggerToast(
            `Successfully disconnected GitHub repository from ${currentProject?.name}.`,
          );
          await refetch();
        },
      },
    });
  }

  return (
    <SettingsContainer
      title="Git Repository"
      description="Create Deployments for commits pushed to your Git repository."
      docsLink="https://docs.nhost.io/platform/github-integration"
      slotProps={{ submitButton: { className: 'hidden' } }}
      className="grid grid-cols-5"
    >
      {!currentProject?.githubRepository ? (
        <Button
          onClick={openGitHubModal}
          className="col-span-5 grid grid-flow-col gap-1.5 xs:col-span-3 lg:col-span-2"
          startIcon={<GitHubIcon className="self-center w-4 h-4" />}
          disabled={maintenanceActive}
        >
          Connect to GitHub
        </Button>
      ) : (
        <Box className="flex flex-row items-center col-span-5 px-4 py-4 border rounded-lg place-content-between">
          <div className="flex flex-row ml-2">
            <GitHubIcon className="mr-1.5 h-7 w-7 self-center" />
            <Text className="self-center font-normal">
              {currentProject?.githubRepository.fullName}
            </Text>
          </div>
          <Button
            disabled={maintenanceActive}
            variant="borderless"
            onClick={handleConnect}
          >
            Disconnect
          </Button>
        </Box>
      )}
    </SettingsContainer>
  );
}
