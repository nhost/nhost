import { Command as CommandPrimitive } from 'cmdk';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { ChevronDown, GitBranch } from 'lucide-react';
import { useState } from 'react';
import { Avatar } from '@/components/ui/v3/avatar';
import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
import { Command, CommandList } from '@/components/ui/v3/command';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/v3/input-group';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import { Spinner } from '@/components/ui/v3/spinner';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { useNewDeploymentSession } from '@/features/orgs/projects/deployments/hooks/useNewDeploymentSession';
import { useScheduleDeployment } from '@/features/orgs/projects/deployments/hooks/useScheduleDeployment';
import { getRedeployWarning } from '@/features/orgs/projects/deployments/utils/getRedeployWarning';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { UnifiedDeploymentRowFragment } from '@/generated/graphql';
import type { GitHubCommit } from '@/lib/github';
import CommitRelation from './CommitRelation';
import DeploySuggestions from './DeploySuggestions';
import GitHubSignIn from './GitHubSignIn';

export interface NewDeploymentPopoverProps {
  liveDeployment: UnifiedDeploymentRowFragment | null;
  ready: boolean;
  inProgress: boolean;
}

interface DeploymentFooterProps {
  disabled: boolean;
  ready: boolean;
  inProgress: boolean;
  onDeploy: () => Promise<void>;
}

function DeploymentFooter({
  disabled,
  ready,
  inProgress,
  onDeploy,
}: DeploymentFooterProps) {
  return (
    <div className="mt-4 flex justify-end border-t pt-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              size="sm"
              disabled={disabled || inProgress || !ready}
              onClick={onDeploy}
            >
              Deploy
            </Button>
          </span>
        </TooltipTrigger>
        {ready && inProgress && (
          <TooltipContent>
            Deployments cannot be re-triggered when a deployment is in progress.
          </TooltipContent>
        )}
      </Tooltip>
    </div>
  );
}

function ResolvedCommit({ commit }: { commit: GitHubCommit }) {
  const date = commit.date
    ? formatDistanceToNowStrict(parseISO(commit.date), { addSuffix: true })
    : null;
  return (
    <div className="grid gap-2 rounded-md border bg-muted/30 p-3">
      <p className="truncate font-medium text-sm">
        {commit.message.split('\n')[0] || 'No commit message'}
      </p>
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <Avatar
          src={commit.avatarUrl}
          name={commit.authorName}
          alt={commit.authorName}
          className="h-5 w-5"
        />
        <span className="truncate">{commit.authorName}</span>
        <span className="font-mono">{commit.sha.slice(0, 7)}</span>
        {date && <span className="ml-auto shrink-0">{date}</span>}
      </div>
    </div>
  );
}

function DeploymentFeedback({
  session,
  liveDeployment,
  ready,
}: Pick<NewDeploymentPopoverProps, 'liveDeployment' | 'ready'> & {
  session: ReturnType<typeof useNewDeploymentSession>;
}) {
  const olderThanLive =
    ready &&
    session.storedDeployment !== null &&
    getRedeployWarning(session.storedDeployment, liveDeployment) === 'older';
  const { history, branches, tags, commits } = session.suggestions;
  const hasSuggestions =
    history.deployments.length +
      branches.length +
      tags.length +
      commits.length >
    0;
  const refError =
    session.searching &&
    hasSuggestions &&
    session.refError === 'No branch, tag or commit matches'
      ? null
      : session.refError;
  const error =
    refError ??
    (session.access === 'unavailable'
      ? 'GitHub is unavailable right now'
      : null);
  return (
    <>
      {(session.access === 'loading' || session.resolving) && (
        <Spinner size="xs">
          <span className="text-muted-foreground text-xs">
            Resolving commit...
          </span>
        </Spinner>
      )}
      {session.target && <ResolvedCommit commit={session.target} />}
      <CommitRelation
        comparing={session.comparing}
        comparison={session.comparison}
        compareFailed={session.compareFailed}
        olderThanLive={olderThanLive}
      />
      {session.refRequiresAccess && (
        <p className="text-muted-foreground text-xs">
          Sign in with GitHub to deploy this ref
        </p>
      )}
      {error && <p className="text-muted-foreground text-xs">{error}</p>}
    </>
  );
}

function NewDeploymentContent({
  appId,
  fullName,
  productionBranch,
  liveDeployment,
  ready,
  inProgress,
  onClose,
}: NewDeploymentPopoverProps & {
  appId: string;
  fullName: string;
  productionBranch: string;
  onClose: VoidFunction;
}) {
  const session = useNewDeploymentSession({
    appId,
    fullName,
    productionBranch,
    liveSHA: liveDeployment?.commitSHA,
    ready,
  });
  const { schedule, scheduling } = useScheduleDeployment();
  const disabled =
    !session.target || session.resolving || session.comparing || scheduling;

  async function deploy() {
    if (disabled || !ready || inProgress || !session.target) {
      return;
    }
    const success = await schedule(
      session.storedDeployment ?? {
        commitSHA: session.target.sha,
        commitMessage: session.target.message,
        commitUserName: session.target.authorName,
        commitUserAvatarUrl: session.target.avatarUrl,
      },
    );
    if (success) {
      onClose();
    }
  }

  return (
    <>
      <Command shouldFilter={false} label="Branch, tag or commit">
        <div className="grid gap-3">
          <div className="grid gap-0.5">
            <p className="font-medium text-sm">
              Deploy a branch, tag or commit
            </p>
            <p className="text-muted-foreground text-xs">From {fullName}</p>
          </div>
          <InputGroup>
            <InputGroupAddon>
              <GitBranch />
            </InputGroupAddon>
            <CommandPrimitive.Input
              asChild
              value={session.input}
              onValueChange={session.setInput}
            >
              <InputGroupInput
                aria-label="Branch, tag or commit"
                placeholder="Branch, tag or commit SHA"
                disabled={session.access === 'loading'}
              />
            </CommandPrimitive.Input>
            {session.input === productionBranch &&
              session.access === 'ready' && (
                <InputGroupAddon align="inline-end">
                  <Badge variant="outline">deployment branch</Badge>
                </InputGroupAddon>
              )}
          </InputGroup>
          {(session.searching || session.access !== 'ready') && (
            <CommandList>
              <DeploySuggestions
                suggestions={session.suggestions}
                query={session.input}
                productionBranch={productionBranch}
                liveDeployment={liveDeployment}
                onPickDeployment={session.pickDeployment}
                onPickRef={session.pickRef}
                onPickCommit={session.pickCommit}
              />
            </CommandList>
          )}
          <DeploymentFeedback
            session={session}
            liveDeployment={liveDeployment}
            ready={ready}
          />
        </div>
      </Command>
      {session.access === 'no-access' && (
        <div className="mt-3">
          <GitHubSignIn
            connectionRequired={session.tokenStatus === 'connection-required'}
          />
        </div>
      )}
      <DeploymentFooter
        disabled={disabled}
        ready={ready}
        inProgress={inProgress}
        onDeploy={deploy}
      />
    </>
  );
}

export default function NewDeploymentPopover(props: NewDeploymentPopoverProps) {
  const { project } = useProject();
  const [open, setOpen] = useState(false);
  const fullName = project?.githubRepository?.fullName;

  if (!fullName) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <GitBranch className="h-4 w-4" />
          New deployment
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-screen max-w-md">
        {open && (
          <NewDeploymentContent
            {...props}
            appId={project.id}
            fullName={fullName}
            productionBranch={project.repositoryProductionBranch ?? ''}
            onClose={() => setOpen(false)}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
