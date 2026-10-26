import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import {
  RotateCcw as ArrowCounterclockwiseIcon,
  ChevronRightIcon,
} from 'lucide-react';
import type { MouseEvent } from 'react';
import { NavLink } from '@/components/common/NavLink';
import { CopyToClipboardButton } from '@/components/presentational/CopyToClipboardButton';
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

function CommitRef({ commitRef }: { commitRef: string | null | undefined }) {
  const isCommitSHA = /^[\da-f]{40}$/i.test(commitRef ?? '');

  return (
    <div className="hidden w-24 items-center justify-end gap-1 sm:flex">
      <span
        title={commitRef ?? undefined}
        className="max-w-16 truncate font-medium font-mono text-foreground text-sm-"
      >
        {isCommitSHA ? commitRef?.substring(0, 7) : commitRef}
      </span>
      <CopyToClipboardButton
        textToCopy={commitRef}
        title={isCommitSHA ? 'Commit SHA' : 'Ref'}
        aria-label={isCommitSHA ? 'Copy commit SHA' : 'Copy ref'}
        className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
      />
    </div>
  );
}

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
    <li className="flex w-full list-none">
      <NavLink
        variant="ghost"
        underline="none"
        className="group grid h-fit w-full grid-flow-col items-center justify-between gap-2 rounded-none p-2 font-medium hover:no-underline"
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
        </div>

        <div className="grid grid-flow-col items-center justify-end gap-2">
          {showRedeploy && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disableRedeploy || scheduling}
                    onClick={redeploy}
                    className="h-auto rounded-full border-primary px-2 py-1 text-primary text-xs hover:bg-primary/10 hover:text-primary"
                    aria-label="Redeploy"
                  >
                    <ArrowCounterclockwiseIcon className="mr-1 h-4 w-4" />
                    Redeploy
                  </Button>
                </span>
              </TooltipTrigger>
              {disableRedeploy && (
                <TooltipContent>
                  Deployments cannot be re-triggered when a deployment is in
                  progress.
                </TooltipContent>
              )}
            </Tooltip>
          )}

          {isLive && (
            <div className="hidden w-12 justify-end sm:flex">
              <Badge
                variant="outline"
                className="border-transparent bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
              >
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

          <StatusCircle status={deployment.status as PipelineRunStatus} />

          <ChevronRightIcon className="h-4 w-4 text-white" />
        </div>
      </NavLink>
    </li>
  );
}
