import { SiGithub as GitHubIcon } from '@icons-pack/react-simple-icons';
import { useFormContext } from 'react-hook-form';
import { useDialog } from '@/components/common/DialogProvider';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Switch } from '@/components/ui/v3/switch';
import { TextLink } from '@/components/ui/v3/text-link';
import { EditRepositoryAndBranchSettings } from '@/features/orgs/projects/git/common/components/EditRepositoryAndBranchSettings';
import type { EditRepositorySettingsFormData } from '@/features/orgs/projects/git/common/components/EditRepositorySettings';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  useConnectGithubRepoMutation,
  useUpdateApplicationMutation,
} from '@/generated/graphql';
import { analytics } from '@/lib/segment';
import { discordAnnounce } from '@/utils/discordAnnounce';
import { triggerToast } from '@/utils/toast';

export interface EditRepositorySettingsModalProps {
  selectedRepoId: string;
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
    setValue,
    formState: { isSubmitting },
  } = useFormContext<EditRepositorySettingsFormData>();
  const automaticDeploys = watch('automaticDeploys');
  const isNotCompleted =
    automaticDeploys &&
    (!watch('productionBranch') || !watch('repoBaseFolder'));
  const { closeAlertDialog } = useDialog();

  const { project, refetch: refetchProject } = useProject();

  const [connectGithubRepo, { loading }] = useConnectGithubRepoMutation();
  const [updateApp] = useUpdateApplicationMutation();

  const handleEditGitHubIntegration = async (
    data: EditRepositorySettingsFormData,
  ) => {
    try {
      await connectGithubRepo({
        variables: {
          appID: project?.id,
          githubNodeID: selectedRepoId,
          productionBranch: data.automaticDeploys
            ? data.productionBranch
            : data.productionBranch || 'main',
          baseFolder: data.automaticDeploys
            ? data.repoBaseFolder
            : data.repoBaseFolder || 'nhost',
        },
      });

      await updateApp({
        variables: {
          appId: project?.id,
          app: {
            automaticDeploys: data.automaticDeploys,
          },
        },
      });

      analytics.track('Project Connected to GitHub', {
        projectId: project?.id,
        projectName: project?.name,
        projectSubdomain: project?.subdomain,
        repositoryId: selectedRepoId,
        productionBranch: data.productionBranch,
        baseFolder: data.repoBaseFolder,
        automaticDeploys: data.automaticDeploys,
      });

      await refetchProject();

      if (close) {
        close();
      } else {
        closeAlertDialog();
      }
      triggerToast('GitHub repository settings successfully updated.');
    } catch (error) {
      await discordAnnounce(
        `Error while trying to edit repository GitHub integration: ${project?.slug}.`,
      );
      throw error;
    }
  };

  return (
    <div className="px-1">
      <div className="flex flex-col">
        <div className="mx-auto h-8 w-8">
          <GitHubIcon className="h-8 w-8" />
        </div>
        <h2 className="mt-1.5 text-center font-medium text-lg">
          {selectedRepoId
            ? 'Configure your GitHub integration'
            : 'Edit your GitHub integration'}
        </h2>
        <p className="text-center text-muted-foreground text-xs">
          Connect your GitHub repository to enable deployments.{' '}
          <TextLink
            href="https://docs.nhost.io/platform/cloud/deployments"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs"
          >
            Learn more
          </TextLink>
        </p>
        <div>
          <RetryableErrorBoundary errorMessageProps={{ className: 'p-0' }}>
            <form
              onSubmit={handleSubmit(handleEditGitHubIntegration)}
              autoComplete="off"
            >
              <div className="mt-4 flex items-center justify-between border-t py-3">
                <div className="flex flex-col">
                  <p className="font-medium text-sm">Automatic Deploys</p>
                  <p className="text-muted-foreground text-xs">
                    Automatically deploy when you push to the deployment branch
                  </p>
                </div>
                <Switch
                  checked={automaticDeploys}
                  onCheckedChange={(checked) =>
                    setValue('automaticDeploys', checked)
                  }
                />
              </div>

              <EditRepositoryAndBranchSettings disabled={!automaticDeploys} />

              <div className="mt-2 flex flex-col">
                <ButtonWithLoading
                  type="submit"
                  loading={isSubmitting || loading}
                  disabled={isSubmitting || isNotCompleted}
                >
                  {selectedRepoId ? 'Connect Repository' : 'Save'}
                </ButtonWithLoading>
              </div>
            </form>
            <div className="mt-2 flex flex-col">
              <Button
                type="button"
                variant="outline"
                className="w-full border-1 hover:border-1"
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
