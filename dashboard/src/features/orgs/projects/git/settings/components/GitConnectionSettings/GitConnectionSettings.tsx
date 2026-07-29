import { SiGithub as GitHubIcon } from '@icons-pack/react-simple-icons';
import { useDialog } from '@/components/common/DialogProvider';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
  SettingsDocsLink,
} from '@/components/layout/SettingsCard';
import { Button } from '@/components/ui/v3/button';
import { useGitHubModal } from '@/features/orgs/projects/git/common/hooks/useGitHubModal';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useUpdateApplicationMutation } from '@/generated/graphql';
import { triggerToast } from '@/utils/toast';

export default function GitConnectionSettings() {
  const { project, refetch } = useProject();
  const [updateApp] = useUpdateApplicationMutation();
  const { openAlertDialog } = useDialog();
  const { openGitHubModal } = useGitHubModal();

  function handleConnect() {
    openAlertDialog({
      title: 'Disconnect GitHub Repository',
      payload: (
        <p>
          Are you sure you want to disconnect{' '}
          <b>{project?.githubRepository?.fullName}</b>?
        </p>
      ),
      props: {
        primaryButtonText: 'Disconnect GitHub Repository',
        primaryButtonColor: 'error',
        onPrimaryAction: async () => {
          await updateApp({
            variables: {
              appId: project?.id,
              app: {
                githubRepositoryId: null,
              },
            },
          });
          triggerToast(
            `Successfully disconnected GitHub repository from ${project?.name}.`,
          );
          await refetch();
        },
      },
    });
  }

  return (
    <SettingsCard>
      <SettingsCardHeader
        title="Git Repository"
        description="Create Deployments for commits pushed to your Git repository."
      />

      <SettingsCardContent className="grid-cols-5">
        {!project?.githubRepository ? (
          <Button
            onClick={openGitHubModal}
            className="col-span-5 xs:col-span-3 grid grid-flow-col gap-1.5 lg:col-span-2"
          >
            <GitHubIcon className="h-4 w-4 self-center" />
            Connect to GitHub
          </Button>
        ) : (
          <div className="col-span-5 flex flex-row place-content-between items-center rounded-lg border px-4 py-4">
            <div className="ml-2 flex flex-row">
              <GitHubIcon className="mr-1.5 h-7 w-7 self-center" />
              <p className="self-center font-normal">
                {project?.githubRepository.fullName}
              </p>
            </div>
            <Button variant="ghost" onClick={handleConnect}>
              Disconnect
            </Button>
          </div>
        )}
      </SettingsCardContent>

      <SettingsCardFooter>
        <SettingsDocsLink
          href="https://docs.nhost.io/platform/cloud/deployments"
          title="Git Repository"
        />
      </SettingsCardFooter>
    </SettingsCard>
  );
}
