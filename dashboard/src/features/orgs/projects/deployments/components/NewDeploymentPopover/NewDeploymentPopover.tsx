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
import { Skeleton } from '@/components/ui/v3/skeleton';
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

const REF_NOT_FOUND = 'No branch, tag or commit matches';

type DeploymentSession = ReturnType<typeof useNewDeploymentSession>;

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

function CommitSkeleton() {
  return (
    <div className="grid gap-2 rounded-md border bg-muted/30 p-3">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-5 w-1/2" />
    </div>
  );
}

function SearchResults({
  session,
  productionBranch,
  liveDeployment,
}: Pick<NewDeploymentPopoverProps, 'liveDeployment'> & {
  session: DeploymentSession;
  productionBranch: string;
}) {
  const { suggestions, input } = session;
  const { history, branches, tags, commits } = suggestions;
  const resultCount =
    history.deployments.length + branches.length + tags.length + commits.length;

  if (resultCount > 0 || history.error) {
    return (
      <CommandList>
        <DeploySuggestions
          suggestions={suggestions}
          query={input}
          productionBranch={productionBranch}
          liveDeployment={liveDeployment}
          onPickDeployment={session.pickDeployment}
          onPickRef={session.pickRef}
          onPickCommit={session.pickCommit}
        />
      </CommandList>
    );
  }
  if (suggestions.loading || session.resolving) {
    return (
      <Spinner size="xs" wrapperClassName="flex-row justify-start gap-1.5">
        <span className="text-muted-foreground text-xs">
          {input ? 'Searching...' : 'Loading deployments...'}
        </span>
      </Spinner>
    );
  }
  // A resolved exact ref or another error already explains the result below.
  if (
    !input ||
    session.target ||
    (session.refError && session.refError !== REF_NOT_FOUND)
  ) {
    return null;
  }
  return (
    <p role="status" className="truncate text-muted-foreground text-xs">
      {`No matches for "${input}"`}
    </p>
  );
}

function DeploymentFeedback({
  session,
  liveDeployment,
  ready,
}: Pick<NewDeploymentPopoverProps, 'liveDeployment' | 'ready'> & {
  session: DeploymentSession;
}) {
  const olderThanLive =
    ready &&
    session.storedDeployment !== null &&
    getRedeployWarning(session.storedDeployment, liveDeployment) === 'older';
  // While searching, the results list already says when nothing matches.
  const refError =
    session.searching && session.refError === REF_NOT_FOUND
      ? null
      : session.refError;
  const error =
    refError ??
    (session.access === 'unavailable'
      ? 'GitHub is unavailable right now'
      : null);
  return (
    <>
      {session.resolving && !session.searching && (
        <div role="status">
          <span className="sr-only">Resolving commit...</span>
          <CommitSkeleton />
        </div>
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
      <Command
        shouldFilter={false}
        label="Branch, tag or commit"
        className="overflow-visible"
      >
        <div className="grid gap-3">
          <div className="grid gap-0.5">
            <p className="font-medium text-sm">
              Deploy a branch, tag or commit
            </p>
            <p className="text-muted-foreground text-xs">From {fullName}</p>
          </div>
          {session.access === 'loading' ? (
            <div className="grid gap-3" role="status">
              <span className="sr-only">Loading...</span>
              <Skeleton className="h-9 w-full" />
              <CommitSkeleton />
            </div>
          ) : (
            <>
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
                <SearchResults
                  session={session}
                  productionBranch={productionBranch}
                  liveDeployment={liveDeployment}
                />
              )}
              <DeploymentFeedback
                session={session}
                liveDeployment={liveDeployment}
                ready={ready}
              />
            </>
          )}
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
          New deployment
          <ChevronDown className="ml-2 h-4 w-4 text-muted-foreground" />
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
