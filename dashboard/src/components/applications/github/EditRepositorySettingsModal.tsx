import type { EditRepositorySettingsFormData } from '@/components/applications/github/EditRepositorySettings';
import { useDialog } from '@/components/common/DialogProvider';
import ErrorBoundaryFallback from '@/components/common/ErrorBoundaryFallback';
import GithubIcon from '@/components/icons/GithubIcon';
import { useUpdateAppMutation } from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import Button from '@/ui/v2/Button';
import Text from '@/ui/v2/Text';
import { discordAnnounce } from '@/utils/discordAnnounce';
import { triggerToast } from '@/utils/toast';
import { updateOwnCache } from '@/utils/updateOwnCache';
import { useApolloClient } from '@apollo/client';
import { ErrorBoundary } from 'react-error-boundary';
import { useFormContext } from 'react-hook-form';
import { RepoAndBranch } from './RepoAndBranch';

export function EditRepositorySettingsModal({
  selectedRepoId,
  close,
  handleSelectAnotherRepository,
}: any) {
  const {
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = useFormContext<EditRepositorySettingsFormData>();
  const isNotCompleted = !watch('productionBranch') || !watch('repoBaseFolder');
  const { closeAlertDialog } = useDialog();

  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const [updateApp, { loading }] = useUpdateAppMutation();

  const client = useApolloClient();

  const handleEditGitHubIntegration = async (
    data: EditRepositorySettingsFormData,
  ) => {
    try {
      if (!currentApplication.githubRepository || selectedRepoId) {
        await updateApp({
          variables: {
            id: currentApplication.id,
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
            id: currentApplication.id,
            app: {
              repositoryProductionBranch: data.productionBranch,
              nhostBaseFolder: data.repoBaseFolder,
            },
          },
        });
      }

      await updateOwnCache(client);
      if (close) {
        close();
      } else {
        closeAlertDialog();
      }
      triggerToast('GitHub repository settings successfully updated.');
    } catch (error) {
      await discordAnnounce(
        `Error while trying to edit repository GitHub integration: ${currentApplication.slug}.`,
      );
      throw error;
    }
  };

  return (
    <div className="px-1">
      <div className="flex flex-col">
        <div className="mx-auto h-8 w-8">
          <GithubIcon className="h-8 w-8" />
        </div>
        <Text className="mt-1.5 text-center text-lg font-medium">
          {selectedRepoId
            ? 'Configure your GitHub integration'
            : 'Edit your GitHub integration'}
        </Text>
        <Text className="text-center text-xs">
          We&apos;ll deploy changes automatically when you push to the
          deployment branch.
        </Text>
        <div>
          <ErrorBoundary fallbackRender={ErrorBoundaryFallback}>
            <form
              onSubmit={handleSubmit(handleEditGitHubIntegration)}
              autoComplete="off"
            >
              <RepoAndBranch />

              <div className="mt-2 flex flex-col">
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
            <div className="mt-2 flex flex-col">
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
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

export default EditRepositorySettingsModal;
