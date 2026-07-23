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
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useUserData } from '@/hooks/useUserData';
import type { UnifiedDeploymentRowFragment } from '@/utils/__generated__/graphql';
import {
  GetOrganizationsDocument,
  useInsertPipelineRunMutation,
} from '@/utils/__generated__/graphql';

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
  const userData = useUserData();

  const relativeDateOfDeployment = deployment.startedAt
    ? formatDistanceToNowStrict(parseISO(deployment.startedAt), {
        addSuffix: true,
      })
    : '';

  const [insertPipelineRun, { loading }] = useInsertPipelineRunMutation({
    refetchQueries: [
      { query: GetOrganizationsDocument, variables: { userId: userData?.id } },
    ],
  });

  async function redeploy(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    event.preventDefault();

    const insertPromise = insertPipelineRun({
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
    });

    await execPromiseWithErrorToast(
      async () => {
        await insertPromise;
      },
      {
        loadingMessage: 'Scheduling deployment...',
        successMessage: 'Deployment has been scheduled successfully.',
        errorMessage: 'An error occurred when scheduling deployment.',
      },
    );
  }

  return (
    <li className="flex w-full list-none">
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
                    disabled={disableRedeploy || loading}
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
              <Badge className="border-transparent bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                Live
              </Badge>
            </div>
          )}

          <div className="hidden w-16 text-right font-medium font-mono text-foreground text-sm- sm:block">
            {deployment.commitSHA?.substring(0, 7)}
          </div>

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
