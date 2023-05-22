import useGitHubModal from '@/components/applications/github/useGitHubModal';
import { useDialog } from '@/components/common/DialogProvider';
import GithubIcon from '@/components/icons/GithubIcon';
import SettingsContainer from '@/components/settings/SettingsContainer';
import { useUI } from '@/context/UIContext';
import { useCurrentWorkspaceAndProject } from '@/features/projects/hooks/useCurrentWorkspaceAndProject';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Text from '@/ui/v2/Text/Text';
import { useUpdateApplicationMutation } from '@/utils/__generated__/graphql';
import { triggerToast } from '@/utils/toast';

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
          <b>{currentProject.githubRepository.fullName}</b>?
        </p>
      ),
      props: {
        primaryButtonText: 'Disconnect GitHub Repository',
        primaryButtonColor: 'error',
        onPrimaryAction: async () => {
          await updateApp({
            variables: {
              appId: currentProject.id,
              app: {
                githubRepositoryId: null,
              },
            },
          });
          triggerToast(
            `Successfully disconnected GitHub repository from ${currentProject.name}.`,
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
      {!currentProject.githubRepository ? (
        <Button
          onClick={openGitHubModal}
          className="col-span-5 grid grid-flow-col gap-1.5 xs:col-span-3 lg:col-span-2"
          startIcon={<GithubIcon className="h-4 w-4 self-center" />}
          disabled={maintenanceActive}
        >
          Connect to GitHub
        </Button>
      ) : (
        <Box className="col-span-5 flex flex-row place-content-between items-center rounded-lg border px-4 py-4">
          <div className="ml-2 flex flex-row">
            <GithubIcon className="mr-1.5 h-7 w-7 self-center" />
            <Text className="self-center font-normal">
              {currentProject.githubRepository.fullName}
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
