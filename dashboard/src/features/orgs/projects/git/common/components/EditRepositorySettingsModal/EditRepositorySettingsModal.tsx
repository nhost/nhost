import { useDialog } from '@/components/common/DialogProvider';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Button } from '@/components/ui/v2/Button';
import { GitHubIcon } from '@/components/ui/v2/icons/GitHubIcon';
import { Text } from '@/components/ui/v2/Text';
import { EditRepositoryAndBranchSettings } from '@/features/orgs/projects/git/common/components/EditRepositoryAndBranchSettings';
import type { EditRepositorySettingsFormData } from '@/features/orgs/projects/git/common/components/EditRepositorySettings';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useUpdateApplicationMutation } from '@/generated/graphql';
import { discordAnnounce } from '@/utils/discordAnnounce';
import { triggerToast } from '@/utils/toast';
import { useFormContext } from 'react-hook-form';

export interface EditRepositorySettingsModalProps {
  selectedRepoId?: string;
  close?: () => void;
  handleSelectAnotherRepository?: () => void;
}

export default function EditRepositorySettingsModal({
  selectedRepoId,
  close,
  handleSelectAnotherRepository,
}: EditRepositorySettingsModalProps) {
  const {
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = useFormContext<EditRepositorySettingsFormData>();
  const isNotCompleted = !watch('productionBranch') || !watch('repoBaseFolder');
  const { closeAlertDialog } = useDialog();

  const { project, refetch: refetchProject } = useProject();

  const [updateApp, { loading }] = useUpdateApplicationMutation();

  const handleEditGitHubIntegration = async (
    data: EditRepositorySettingsFormData,
  ) => {
    try {
      if (!project?.githubRepository || selectedRepoId) {
        await updateApp({
          variables: {
            appId: project.id,
            app: {
              githubRepositoryId: selectedRepoId,
              repositoryProductionBranch: data.productionBranch,
              nhostBaseFolder: data.repoBaseFolder,
            },
          },
        });
      } else {
        await updateApp({
          variables: {
            appId: project.id,
            app: {
              repositoryProductionBranch: data.productionBranch,
              nhostBaseFolder: data.repoBaseFolder,
            },
          },
        });
      }

      await refetchProject();

      if (close) {
        close();
      } else {
        closeAlertDialog();
      }
      triggerToast('GitHub repository settings successfully updated.');
    } catch (error) {
      await discordAnnounce(
        `Error while trying to edit repository GitHub integration: ${project.slug}.`,
      );
      throw error;
    }
  };

  return (
    <div className="px-1">
      <div className="flex flex-col">
        <div className="w-8 h-8 mx-auto">
          <GitHubIcon className="w-8 h-8" />
        </div>
        <Text className="mt-1.5 text-center text-lg font-medium">
          {selectedRepoId
            ? 'Configure your GitHub integration'
            : 'Edit your GitHub integration'}
        </Text>
        <Text className="text-xs text-center">
          We&apos;ll deploy changes automatically when you push to the
          deployment branch.
        </Text>
        <div>
          <RetryableErrorBoundary>
            <form
              onSubmit={handleSubmit(handleEditGitHubIntegration)}
              autoComplete="off"
            >
              <EditRepositoryAndBranchSettings />

              <div className="flex flex-col mt-2">
                <Button
                  type="submit"
                  color="primary"
                  variant="contained"
                  className=""
                  loading={isSubmitting || loading}
                  disabled={isSubmitting || isNotCompleted}
                >
                  {selectedRepoId ? `Connect Repository` : `Save`}
                </Button>
              </div>
            </form>
            <div className="flex flex-col mt-2">
              <Button
                type="button"
                variant="outlined"
                className="w-full border-1 hover:border-1"
                color="secondary"
                onClick={handleSelectAnotherRepository}
              >
                Select another repository
              </Button>
            </div>
          </RetryableErrorBoundary>
        </div>
      </div>
    </div>
  );
}
