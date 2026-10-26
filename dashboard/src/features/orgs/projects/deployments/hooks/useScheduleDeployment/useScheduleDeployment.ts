import { useRef } from 'react';
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
  'commitSHA' | 'commitUserName' | 'commitUserAvatarUrl' | 'commitMessage'
>;

export default function useScheduleDeployment() {
  const { project } = useProject();
  const userData = useUserData();
  const inFlight = useRef(false);
  const [insertPipelineRun, { loading: scheduling }] =
    useInsertPipelineRunMutation({
      refetchQueries: [
        {
          query: GetOrganizationsDocument,
          variables: { userId: userData?.id },
        },
      ],
    });

  async function schedule(commit: DeploymentCommit): Promise<boolean> {
    if (inFlight.current) {
      return false;
    }
    inFlight.current = true;
    try {
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
    } finally {
      inFlight.current = false;
    }
  }

  return { schedule, scheduling };
}
