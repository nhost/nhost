import { useState } from 'react';
import {
  getRedeployWarning,
  type RedeployWarning,
} from '@/features/orgs/projects/deployments/utils/redeploy-warning';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  GetOrganizationsDocument,
  type UnifiedDeploymentRowFragment,
  useInsertPipelineRunMutation,
} from '@/generated/graphql';
import { useUserData } from '@/hooks/useUserData';

/**
 * Redeploys `deployment` right away when it is the live commit or nothing is
 * live. Otherwise `redeploy` sets `warning`, and the deployment is only
 * scheduled once the user confirms.
 */
export default function useRedeployDeployment(
  deployment: UnifiedDeploymentRowFragment,
  liveDeployment: UnifiedDeploymentRowFragment | null,
) {
  const { project } = useProject();
  const userData = useUserData();
  const [warning, setWarning] = useState<RedeployWarning | null>(null);
  const [insertPipelineRun, { loading: scheduling }] =
    useInsertPipelineRunMutation({
      refetchQueries: [
        {
          query: GetOrganizationsDocument,
          variables: { userId: userData?.id },
        },
      ],
    });

  async function schedule() {
    const result = await execPromiseWithErrorToast(
      () =>
        insertPipelineRun({
          variables: {
            object: {
              input: {
                name: 'nhost-backend-build',
                app_id: project?.id,
                commit_sha: deployment.commitSHA,
                commit_user_name: deployment.commitUserName,
                commit_user_avatar_url: deployment.commitUserAvatarUrl,
                commit_message: deployment.commitMessage,
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

  async function redeploy() {
    const nextWarning = getRedeployWarning(deployment, liveDeployment);
    if (nextWarning) {
      setWarning(nextWarning);
      return;
    }
    await schedule();
  }

  async function confirm() {
    if (await schedule()) {
      setWarning(null);
    }
  }

  return {
    redeploy,
    confirm,
    cancel: () => setWarning(null),
    warning,
    scheduling,
  };
}
