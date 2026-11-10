import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import {
  RotateCcw as ArrowCounterclockwiseIcon,
  ChevronRightIcon,
} from 'lucide-react';
import type { MouseEvent } from 'react';
import { NavLink } from '@/components/common/NavLink';
import type { PipelineRunStatus } from '@/components/presentational/StatusCircle';
import { StatusCircle } from '@/components/presentational/StatusCircle';
import { Avatar } from '@/components/ui/v3/avatar';
import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { DeploymentDurationLabel } from '@/features/orgs/projects/deployments/components/DeploymentDurationLabel';
import { useScheduleDeployment } from '@/features/orgs/projects/deployments/hooks/useScheduleDeployment';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { UnifiedDeploymentRowFragment } from '@/generated/graphql';
import { cn } from '@/lib/utils';
import CommitRef from './CommitRef';

export interface DeploymentListItemProps {
  deployment: UnifiedDeploymentRowFragment;
  isLive?: boolean;
  showRedeploy?: boolean;
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
  const { schedule, scheduling } = useScheduleDeployment();

  const deploymentDate = deployment.startedAt ?? deployment.createdAt;
  const isFailed =
    deployment.status === 'failed' || deployment.status === 'FAILED';
  const isSucceeded =
    deployment.status === 'succeeded' || deployment.status === 'DEPLOYED';
  const relativeDateOfDeployment = deploymentDate
    ? formatDistanceToNowStrict(parseISO(deploymentDate), {
        addSuffix: true,
      })
    : '';

  async function redeploy(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    event.preventDefault();
    await schedule(deployment);
  }

  return (
    <li
      className={cn(
        'flex w-full list-none',
        isFailed && 'border-l-2 border-l-destructive bg-destructive/5',
      )}
    >
      <NavLink
        variant="ghost"
        underline="none"
        className="grid h-fit w-full grid-flow-col items-center justify-between gap-2 rounded-none p-2 font-medium hover:no-underline"
        href={`/orgs/${org?.slug}/projects/${project?.subdomain}/deployments/${deployment.id}`}
        aria-label={deployment.commitMessage || 'No commit message'}
      >
        <div className="grid grid-flow-col items-center justify-center gap-2 self-center">
          <Avatar
            alt={deployment.commitUserName ?? undefined}
            name={deployment.commitUserName ?? undefined}
            src={deployment.commitUserAvatarUrl}
            className="h-8 w-8 shrink-0"
          />

          <div className="grid min-w-0 justify-start gap-0.5">
            <span className="truncate font-medium">
              {deployment.commitMessage?.trim() || (
                <span className="truncate pr-1 font-normal italic">
                  No commit message
                </span>
              )}
            </span>
            <span className="truncate text-muted-foreground text-sm">
              {relativeDateOfDeployment}
            </span>
          </div>

          {showRedeploy && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    type="button"
                    variant="subtle"
                    disabled={disableRedeploy || scheduling}
                    onClick={redeploy}
                    aria-label="Redeploy"
                  >
                    <ArrowCounterclockwiseIcon />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {disableRedeploy
                  ? 'Deployments cannot be re-triggered when a deployment is in progress.'
                  : 'Redeploy'}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="grid grid-flow-col items-center justify-end gap-2">
          {isFailed && (
            <div className="hidden justify-end sm:flex">
              <Badge variant="error" className="h-6">
                Failed
              </Badge>
            </div>
          )}

          {isLive && (
            <div className="hidden w-12 justify-end sm:flex">
              <Badge variant="success" className="h-6">
                Live
              </Badge>
            </div>
          )}

          <CommitRef commitRef={deployment.commitSHA} />

          <div className="text-right font-medium font-mono text-sm- sm:w-20">
            <DeploymentDurationLabel
              startedAt={deployment.startedAt}
              endedAt={deployment.endedAt}
            />
          </div>

          {/* Success is the normal case and a dot next to Live read like a
              second live marker. Only other states get a dot; the spacer
              keeps the columns aligned. */}
          {isSucceeded ? (
            <span aria-hidden className="w-1.5" />
          ) : (
            <StatusCircle status={deployment.status as PipelineRunStatus} />
          )}

          <ChevronRightIcon className="h-4 w-4 text-white" />
        </div>
      </NavLink>
    </li>
  );
}
