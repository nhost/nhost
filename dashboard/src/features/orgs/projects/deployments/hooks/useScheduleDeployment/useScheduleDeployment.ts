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
  'commitSHA' | 'commitMessage' | 'commitUserName' | 'commitUserAvatarUrl'
>;

/**
 * Schedules a deployment of `commitSHA`, which can also be a branch or tag:
 * the backend checks out whatever ref it gets.
 */
export default function useScheduleDeployment() {
  const { project } = useProject();
  const userData = useUserData();
  const [insertPipelineRun, { loading: scheduling }] =
    useInsertPipelineRunMutation({
      refetchQueries: [
        {
          query: GetOrganizationsDocument,
          variables: { userId: userData?.id },
        },
      ],
    });

  async function schedule(commit: DeploymentCommit) {
    const result = await execPromiseWithErrorToast(
      () =>
        insertPipelineRun({
          variables: {
            object: {
              input: {
                name: 'nhost-backend-build',
                app_id: project?.id,
                commit_sha: commit.commitSHA,
                commit_user_name: commit.commitUserName,
                commit_user_avatar_url: commit.commitUserAvatarUrl,
                commit_message: commit.commitMessage,
              },
            },
          },
        }),
      {
        loadingMessage: 'Scheduling deployment...',
        successMessage: 'Deployment has been scheduled successfully.',
        errorMessage: 'An error occurred when scheduling deployment.',
      },
    );
    return result !== null;
  }

  return { schedule, scheduling };
}
