import NavLink from '@/components/common/NavLink';
import AppDeploymentDuration from '@/components/deployments/AppDeploymentDuration';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Avatar } from '@/ui/Avatar';
import type { DeploymentStatus } from '@/ui/StatusCircle';
import { StatusCircle } from '@/ui/StatusCircle';
import Button from '@/ui/v2/Button';
import Chip from '@/ui/v2/Chip';
import ArrowCounterclockwiseIcon from '@/ui/v2/icons/ArrowCounterclockwiseIcon';
import ChevronRightIcon from '@/ui/v2/icons/ChevronRightIcon';
import { ListItem } from '@/ui/v2/ListItem';
import Tooltip from '@/ui/v2/Tooltip';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import type { DeploymentRowFragment } from '@/utils/__generated__/graphql';
import { useInsertDeploymentMutation } from '@/utils/__generated__/graphql';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { toast } from 'react-hot-toast';
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
  const { currentWorkspace, currentApplication } =
    useCurrentWorkspaceAndApplication();

  const relativeDateOfDeployment = deployment.deploymentStartedAt
    ? formatDistanceToNowStrict(parseISO(deployment.deploymentStartedAt), {
        addSuffix: true,
      })
    : '';

  const [insertDeployment, { loading }] = useInsertDeploymentMutation();
  const { commitMessage } = deployment;

  return (
    <ListItem.Root>
      <ListItem.Button
        className="grid grid-flow-col items-center justify-between gap-2 px-2 py-2"
        component={NavLink}
        href={`/${currentWorkspace.slug}/${currentApplication.slug}/deployments/${deployment.id}`}
      >
        <div className="flex cursor-pointer flex-row items-center justify-center space-x-2 self-center">
          <ListItem.Avatar>
            <Avatar
              name={deployment.commitUserName}
              avatarUrl={deployment.commitUserAvatarUrl}
              className="h-8 w-8 shrink-0"
            />
          </ListItem.Avatar>

          <ListItem.Text
            primary={
              commitMessage?.trim() || (
                <span className="truncate pr-1 font-normal italic">
                  No commit message
                </span>
              )
            }
            secondary={relativeDateOfDeployment}
          />
        </div>

        <div className="grid grid-flow-col gap-2 items-center">
          {showRedeploy && (
            <Tooltip
              title="Deployments cannot be re-triggered when a deployment is in progress."
              hasDisabledChildren={disableRedeploy || loading}
              disableHoverListener={!disableRedeploy}
            >
              <Button
                disabled={disableRedeploy || loading}
                size="small"
                color="secondary"
                variant="outlined"
                onClick={async (event) => {
                  event.stopPropagation();
                  event.preventDefault();

                  const insertDeploymentPromise = insertDeployment({
                    variables: {
                      object: {
                        appId: currentApplication?.id,
                        commitMessage: deployment.commitMessage,
                        commitSHA: deployment.commitSHA,
                        commitUserAvatarUrl: deployment.commitUserAvatarUrl,
                        commitUserName: deployment.commitUserName,
                        deploymentStatus: 'SCHEDULED',
                      },
                    },
                  });

                  await toast.promise(
                    insertDeploymentPromise,
                    {
                      loading: 'Scheduling deployment...',
                      success: 'Deployment has been scheduled successfully.',
                      error: 'An error occurred when scheduling deployment.',
                    },
                    getToastStyleProps(),
                  );
                }}
                startIcon={
                  <ArrowCounterclockwiseIcon className={twMerge('w-4 h-4')} />
                }
                className="rounded-full py-1 px-2 text-xs"
              >
                Redeploy
              </Button>
            </Tooltip>
          )}

          {isLive && (
            <div className="w-12 flex justify-end">
              <Chip size="small" color="success" label="Live" />
            </div>
          )}

          <div className="w-16 text-right font-mono text-sm- font-medium">
            {deployment.commitSHA.substring(0, 7)}
          </div>

          <div className="w-[80px] text-right font-mono text-sm- font-medium">
            <AppDeploymentDuration
              startedAt={deployment.deploymentStartedAt}
              endedAt={deployment.deploymentEndedAt}
            />
          </div>

          <StatusCircle
            status={deployment.deploymentStatus as DeploymentStatus}
          />

          <ChevronRightIcon className="h-4 w-4" />
        </div>
      </ListItem.Button>
    </ListItem.Root>
  );
}
