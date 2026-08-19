import { SiGithub as GitHubIcon } from '@icons-pack/react-simple-icons';
import { useState } from 'react';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
  SettingsDocsLink,
} from '@/components/layout/SettingsCard';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/v3/alert-dialog';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { useGitHubModal } from '@/features/orgs/projects/git/common/hooks/useGitHubModal';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useUpdateApplicationMutation } from '@/generated/graphql';
import { triggerToast } from '@/utils/toast';

export default function GitConnectionSettings() {
  const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false);
  const { project, refetch } = useProject();
  const [updateApp, { loading: isDisconnecting }] =
    useUpdateApplicationMutation();
  const { openGitHubModal } = useGitHubModal();

  async function handleDisconnect() {
    try {
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
      setIsDisconnectDialogOpen(false);
    } catch (error) {
      console.error('Failed to disconnect GitHub repository:', error);
      triggerToast(
        `Failed to disconnect GitHub repository from ${project?.name}.`,
      );
    }
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
            <Button
              variant="ghost"
              onClick={() => setIsDisconnectDialogOpen(true)}
            >
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

      <AlertDialog
        open={isDisconnectDialogOpen}
        onOpenChange={setIsDisconnectDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect GitHub Repository</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect{' '}
              <span className="font-semibold text-foreground">
                {project?.githubRepository?.fullName}
              </span>
              ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDisconnecting}>
              Cancel
            </AlertDialogCancel>
            <ButtonWithLoading
              type="button"
              variant="destructive"
              loading={isDisconnecting}
              disabled={isDisconnecting}
              onClick={handleDisconnect}
            >
              Disconnect GitHub Repository
            </ButtonWithLoading>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsCard>
  );
}
