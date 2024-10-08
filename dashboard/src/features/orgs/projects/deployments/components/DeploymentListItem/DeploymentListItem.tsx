import { NavLink } from '@/components/common/NavLink';
import type { DeploymentStatus } from '@/components/presentational/StatusCircle';
import { StatusCircle } from '@/components/presentational/StatusCircle';
import { Avatar } from '@/components/ui/v1/Avatar';
import { Button } from '@/components/ui/v2/Button';
import { Chip } from '@/components/ui/v2/Chip';
import { ArrowCounterclockwiseIcon } from '@/components/ui/v2/icons/ArrowCounterclockwiseIcon';
import { ChevronRightIcon } from '@/components/ui/v2/icons/ChevronRightIcon';
import { ListItem } from '@/components/ui/v2/ListItem';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { DeploymentDurationLabel } from '@/features/orgs/projects/deployments/components/DeploymentDurationLabel';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { DeploymentRowFragment } from '@/utils/__generated__/graphql';
import {
  GetAllWorkspacesAndProjectsDocument,
  useInsertDeploymentMutation,
} from '@/utils/__generated__/graphql';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import type { MouseEvent } from 'react';
import { twMerge } from 'tailwind-merge';

export interface DeploymentListItemProps {
  /**
   * Deployment data.
   */
  deployment: DeploymentRowFragment;
  /**
   * Determines whether or not the deployment is live.
   */
  isLive?: boolean;
  /**
   * Determines whether or not the redeploy button should be shown for the
   * deployment.
   */
  showRedeploy?: boolean;
  /**
   * Determines whether or not the redeploy button is disabled.
   */
  disableRedeploy?: boolean;
}

export default function DeploymentListItem({
  deployment,
  isLive,
  showRedeploy,
  disableRedeploy,
}: DeploymentListItemProps) {
  const { project } = useProject();
  const { org } = useCurrentOrg();

  const relativeDateOfDeployment = deployment.deploymentStartedAt
    ? formatDistanceToNowStrict(parseISO(deployment.deploymentStartedAt), {
        addSuffix: true,
      })
    : '';

  const [insertDeployment, { loading }] = useInsertDeploymentMutation({
    refetchQueries: [{ query: GetAllWorkspacesAndProjectsDocument }],
  });
  const { commitMessage } = deployment;

  async function redeployDeployment(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    event.preventDefault();

    const insertDeploymentPromise = insertDeployment({
      variables: {
        object: {
          appId: project?.id,
          commitMessage: deployment.commitMessage,
          commitSHA: deployment.commitSHA,
          commitUserAvatarUrl: deployment.commitUserAvatarUrl,
          commitUserName: deployment.commitUserName,
          deploymentStatus: 'SCHEDULED',
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await insertDeploymentPromise;
      },
      {
        loadingMessage: 'Scheduling deployment...',
        successMessage: 'Deployment has been scheduled successfully.',
        errorMessage: 'An error occurred when scheduling deployment.',
      },
    );
  }

  return (
    <ListItem.Root>
      <ListItem.Button
        className="grid items-center justify-between grid-flow-col gap-2 p-2 rounded-none"
        component={NavLink}
        href={`/orgs/${org?.slug}/projects/${project?.slug}/deployments/${deployment.id}`}
        aria-label={commitMessage || 'No commit message'}
      >
        <div className="grid items-center self-center justify-center grid-flow-col gap-2">
          <ListItem.Avatar>
            <Avatar
              name={deployment.commitUserName}
              avatarUrl={deployment.commitUserAvatarUrl}
              className="w-8 h-8 shrink-0"
            />
          </ListItem.Avatar>

          <ListItem.Text
            primary={
              commitMessage?.trim() || (
                <span className="pr-1 italic font-normal truncate">
                  No commit message
                </span>
              )
            }
            secondary={relativeDateOfDeployment}
          />
        </div>

        <div className="grid items-center justify-end grid-flow-col gap-2">
          {showRedeploy && (
            <Tooltip
              title={
                disableRedeploy || loading
                  ? 'Deployments cannot be re-triggered when a deployment is in progress.'
                  : ''
              }
              hasDisabledChildren={disableRedeploy || loading}
              disableHoverListener={!disableRedeploy}
            >
              <Button
                disabled={disableRedeploy || loading}
                size="small"
                color="secondary"
                variant="outlined"
                onClick={redeployDeployment}
                startIcon={
                  <ArrowCounterclockwiseIcon className={twMerge('h-4 w-4')} />
                }
                className="px-2 py-1 text-xs rounded-full"
                aria-label="Redeploy"
              >
                Redeploy
              </Button>
            </Tooltip>
          )}

          {isLive && (
            <div className="justify-end hidden w-12 sm:flex">
              <Chip size="small" color="success" label="Live" />
            </div>
          )}

          <div className="hidden w-16 font-mono font-medium text-right text-sm- sm:block">
            {deployment.commitSHA.substring(0, 7)}
          </div>

          <div className="font-mono font-medium text-right text-sm- sm:w-20">
            <DeploymentDurationLabel
              startedAt={deployment.deploymentStartedAt}
              endedAt={deployment.deploymentEndedAt}
            />
          </div>

          <StatusCircle
            status={deployment.deploymentStatus as DeploymentStatus}
          />

          <ChevronRightIcon className="w-4 h-4" />
        </div>
      </ListItem.Button>
    </ListItem.Root>
  );
}
