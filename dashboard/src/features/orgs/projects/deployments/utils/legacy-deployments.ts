import type {
  DeploymentRowFragment,
  PipelineRunRowFragment,
} from '@/utils/__generated__/graphql';
import { PipelineRunStatus_Enum } from '@/utils/__generated__/graphql';

const DEPLOYMENT_STATUS_TO_PIPELINE_RUN: Record<
  string,
  PipelineRunStatus_Enum
> = {
  DEPLOYED: PipelineRunStatus_Enum.Succeeded,
  FAILED: PipelineRunStatus_Enum.Failed,
  SCHEDULED: PipelineRunStatus_Enum.Pending,
  PENDING: PipelineRunStatus_Enum.Pending,
  DEPLOYING: PipelineRunStatus_Enum.Running,
};

/**
 * Converts a legacy DeploymentRowFragment into a PipelineRunRowFragment shape
 * so it can be rendered by the same list components used for pipeline runs.
 */
export function legacyDeploymentToListItem(
  deployment: DeploymentRowFragment,
): PipelineRunRowFragment {
  return {
    __typename: 'pipelineRuns',
    id: deployment.id,
    name: 'legacy-deployment',
    startedAt: deployment.deploymentStartedAt,
    endedAt: deployment.deploymentEndedAt,
    status:
      DEPLOYMENT_STATUS_TO_PIPELINE_RUN[deployment.deploymentStatus ?? ''] ??
      PipelineRunStatus_Enum.Failed,
    input: {
      name: 'legacy-deployment',
      app_id: '',
      commit_sha: deployment.commitSHA,
      commit_user_name: deployment.commitUserName ?? undefined,
      commit_user_avatar_url: deployment.commitUserAvatarUrl ?? undefined,
      commit_message: deployment.commitMessage ?? undefined,
    },
    appId: '',
    createdAt: deployment.deploymentStartedAt,
  };
}

/**
 * Returns the ID of the latest live (DEPLOYED) legacy deployment, or empty string.
 */
export function getLastLiveDeployment(
  deployments?: DeploymentRowFragment[],
): string {
  if (!deployments) {
    return '';
  }
  return deployments.find((d) => d.deploymentStatus === 'DEPLOYED')?.id || '';
}
