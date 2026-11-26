import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  GetOrganizationsDocument,
  type UnifiedDeploymentRowFragment,
  useInsertPipelineRunMutation,
} from '@/generated/graphql';
import { useUserData } from '@/hooks/useUserData';

export type DeploymentCommit = Pick<
  UnifiedDeploymentRowFragment,
  'commitSHA' | 'commitMessage'
>;

/**
 * Schedules a deployment of `commitSHA`, which can also be a branch or tag:
 * the backend checks out whatever ref it gets. Deployments are credited to the
 * signed-in user.
 */
export default function useScheduleDeployment() {
  const { project } = useProject();
  const userData = useUserData();
  const userName = userData?.displayName || userData?.email;
  const [insertPipelineRun, { loading: scheduling }] =
    useInsertPipelineRunMutation({
      refetchQueries: [
        {
          query: GetOrganizationsDocument,
          variables: { userId: userData?.id },
        },
      ],
    });

  async function schedule(
    commit: DeploymentCommit,
    onScheduled?: VoidFunction,
  ) {
    await execPromiseWithErrorToast(
      async () => {
        await insertPipelineRun({
          variables: {
            object: {
              input: {
                name: 'nhost-backend-build',
                app_id: project?.id,
                commit_sha: commit.commitSHA,
                commit_user_name: userName,
                commit_user_avatar_url: userData?.avatarUrl,
                commit_message: commit.commitMessage,
              },
            },
          },
        });
        onScheduled?.();
      },
      {
        loadingMessage: 'Scheduling deployment...',
        successMessage: 'Deployment has been scheduled successfully.',
        errorMessage: 'An error occurred when scheduling deployment.',
      },
    );
  }

  return { schedule, scheduling };
}
