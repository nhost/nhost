import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import type { MouseEvent } from 'react';
import { twMerge } from 'tailwind-merge';
import { NavLink } from '@/components/common/NavLink';
import type { PipelineRunStatus } from '@/components/presentational/StatusCircle';
import { StatusCircle } from '@/components/presentational/StatusCircle';
import { Avatar } from '@/components/ui/v2/Avatar';
import { Button } from '@/components/ui/v2/Button';
import { Chip } from '@/components/ui/v2/Chip';
import { ArrowCounterclockwiseIcon } from '@/components/ui/v2/icons/ArrowCounterclockwiseIcon';
import { ChevronRightIcon } from '@/components/ui/v2/icons/ChevronRightIcon';
import { ListItem } from '@/components/ui/v2/ListItem';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { DeploymentDurationLabel } from '@/features/orgs/projects/deployments/components/DeploymentDurationLabel';
import type { PipelineRunInput } from '@/features/orgs/projects/deployments/types';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useUserData } from '@/hooks/useUserData';
import { ifNullconvertToUndefined } from '@/lib/utils';
import type { PipelineRunRowFragment } from '@/utils/__generated__/graphql';
import {
  GetOrganizationsDocument,
  useInsertPipelineRunMutation,
} from '@/utils/__generated__/graphql';

export interface DeploymentListItemProps {
  pipelineRun: PipelineRunRowFragment;
  isLive?: boolean;
  showRedeploy?: boolean;
  disableRedeploy?: boolean;
}

export default function DeploymentListItem({
  pipelineRun,
  isLive,
  showRedeploy,
  disableRedeploy,
}: DeploymentListItemProps) {
  const { project } = useProject();
  const { org } = useCurrentOrg();
  const userData = useUserData();

  const input = pipelineRun.input as PipelineRunInput;

  const relativeDateOfDeployment = pipelineRun.startedAt
    ? formatDistanceToNowStrict(parseISO(pipelineRun.startedAt), {
        addSuffix: true,
      })
    : '';

  const [insertPipelineRun, { loading }] = useInsertPipelineRunMutation({
    refetchQueries: [
      { query: GetOrganizationsDocument, variables: { userId: userData?.id } },
    ],
  });

  const commitMessage = input?.commit_message;

  async function redeployPipelineRun(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    event.preventDefault();

    const insertPromise = insertPipelineRun({
      variables: {
        object: {
          input: {
            name: 'nhost-backend-build',
            app_id: project?.id,
            commit_sha: input.commit_sha,
            commit_user_name: input.commit_user_name,
            commit_user_avatar_url: input.commit_user_avatar_url,
            commit_message: input.commit_message,
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
    <ListItem.Root>
      <ListItem.Button
        className="grid h-fit grid-flow-col items-center justify-between gap-2 rounded-none p-2 hover:no-underline"
        component={NavLink}
        href={`/orgs/${org?.slug}/projects/${project?.subdomain}/deployments/${pipelineRun.id}`}
        aria-label={commitMessage || 'No commit message'}
      >
        <div className="grid grid-flow-col items-center justify-center gap-2 self-center">
          <ListItem.Avatar>
            <Avatar
              alt={ifNullconvertToUndefined(input?.commit_user_name)}
              src={ifNullconvertToUndefined(input?.commit_user_avatar_url)}
              className="h-8 w-8 shrink-0"
            >
              {input?.commit_user_name ?? ''}
            </Avatar>
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

        <div className="grid grid-flow-col items-center justify-end gap-2">
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
                onClick={redeployPipelineRun}
                startIcon={
                  <ArrowCounterclockwiseIcon className={twMerge('h-4 w-4')} />
                }
                className="rounded-full px-2 py-1 text-xs"
                aria-label="Redeploy"
              >
                Redeploy
              </Button>
            </Tooltip>
          )}

          {isLive && (
            <div className="hidden w-12 justify-end sm:flex">
              <Chip size="small" color="success" label="Live" />
            </div>
          )}

          <div className="hidden w-16 text-right font-medium font-mono text-sm- text-white sm:block">
            {input?.commit_sha?.substring(0, 7)}
          </div>

          <div className="text-right font-medium font-mono text-sm- sm:w-20">
            <DeploymentDurationLabel
              startedAt={pipelineRun.startedAt}
              endedAt={pipelineRun.endedAt}
            />
          </div>

          <StatusCircle status={pipelineRun.status as PipelineRunStatus} />

          <ChevronRightIcon className="h-4 w-4 text-white" />
        </div>
      </ListItem.Button>
    </ListItem.Root>
  );
}
