import { SiGithub } from '@icons-pack/react-simple-icons';
import {
  Clock,
  FileText,
  GitPullRequest,
  MessageSquare,
  Pencil,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { type ReactNode, useState } from 'react';
import { Avatar } from '@/components/ui/v3/avatar';
import { Button } from '@/components/ui/v3/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/v3/input-group';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import {
  BranchIcon,
  BranchStatusMark,
  CurrentBadge,
  ProductionBadge,
} from '@/features/orgs/projects/branches/components/BranchBits';
import {
  BranchLogsDialog,
  PullRequestCommentDialog,
  RenameBranchDialog,
} from '@/features/orgs/projects/branches/components/BranchDialogs';
import {
  type Branch,
  ordinal,
  timeAgo,
  useDummyBranches,
  type WaitingPullRequest,
} from '@/features/orgs/projects/branches/dummy/useDummyBranches';
import { cn } from '@/lib/utils';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';
import { triggerToast } from '@/utils/toast';

type DialogState =
  | { kind: 'logs' | 'rename'; branch: Branch }
  | { kind: 'comment'; pullRequest: WaitingPullRequest; position: number }
  | null;

interface RowActionProps {
  label: string;
  icon: ReactNode;
  tooltip?: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}

/**
 * Icon button for a branch row action, with its name in a tooltip. Every row
 * shows the same actions in the same order; one that doesn't apply stays in
 * place but disabled, so the icons line up across rows.
 */
function RowAction({
  label,
  icon,
  tooltip,
  disabled = false,
  onClick,
}: RowActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* The span keeps the tooltip working on disabled buttons. */}
        <span className="inline-flex">
          {/* The dashboard's icon-only button: no background, the icon
              turns primary on hover. */}
          <Button
            variant="subtle"
            size="icon-sm"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
          >
            {icon}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip ?? label}</TooltipContent>
    </Tooltip>
  );
}

/** Branches come from pull requests, so they need a GitHub repository. */
function ConnectGitHub() {
  const router = useRouter();
  const orgSlug = getSingleQueryParam(router.query.orgSlug);
  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);

  return (
    <div className="grid place-items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
      <SiGithub className="size-6" />
      <p className="font-medium text-sm">Connect GitHub to use branches</p>
      <p className="max-w-sm text-muted-foreground text-sm">
        Every pull request gets its own branch, and merging it ships the changes
        to production.
      </p>
      <Button asChild size="sm">
        <Link
          href={`/orgs/${orgSlug}/projects/${appSubdomain}/deployments/settings`}
        >
          Connect GitHub
        </Link>
      </Button>
    </div>
  );
}

/** Opens Settings, where the limit lives. */
function RaiseLimitLink() {
  const router = useRouter();
  return (
    <Button asChild variant="outline" size="sm">
      <Link
        href={{
          pathname: router.pathname,
          query: { ...router.query, tab: 'settings' },
        }}
        shallow
        scroll={false}
      >
        Raise limit
      </Link>
    </Button>
  );
}

/** Place in the queue, same pill shape as the status tags, quiet gray. */
function QueueMark({ position }: { position: number }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border bg-muted px-2 py-px font-medium text-muted-foreground text-xs">
      <Clock className="size-3" />
      {position === 1 ? 'Next' : `${ordinal(position)} in line`}
    </span>
  );
}

export default function AllBranches() {
  const {
    branches,
    production,
    currentBranch,
    switchTo,
    repository,
    branchCount,
    branchLimit,
    atLimit,
    automaticBranching,
    githubConnected,
    waiting,
  } = useDummyBranches();
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<DialogState>(null);

  if (!githubConnected) {
    return <ConnectGitHub />;
  }

  const query = search.trim().toLowerCase();
  const others = branches
    .filter((b) => !b.isProduction)
    .filter((b) => b.name.includes(query) || b.gitBranch.includes(query));

  function renderRow(branch: Branch) {
    const isCurrent = branch.id === currentBranch.id;
    // A click on the row opens the branch (not the one you're on, and not
    // while it's being created or deleted).
    const clickable =
      !isCurrent &&
      branch.status !== 'creating' &&
      branch.status !== 'deleting';

    return (
      <li
        key={branch.id}
        className={cn(
          'relative flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3',
          clickable && 'cursor-pointer hover:bg-accent',
        )}
      >
        {clickable && (
          // Covers the row so a click anywhere opens the branch. The pull
          // request link and the actions sit above it (z-10).
          <button
            type="button"
            aria-label={`Open ${branch.name}`}
            className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            onClick={() => {
              switchTo(branch.id);
              triggerToast(`Opened ${branch.name}`);
            }}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <BranchIcon branch={branch} />
            <span className="truncate font-medium font-mono text-sm">
              {branch.name}
            </span>
            {branch.isProduction && <ProductionBadge />}
            {isCurrent && !branch.isProduction && <CurrentBadge />}
          </div>
          {/* What the branch is for: its pull request title, linked to
              GitHub. The git branch name is nearly the same as the branch
              name, so it lives in the tooltip instead of repeating it.
              Production shows the git branch it follows. */}
          {branch.pullRequest ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={`https://github.com/${repository}/pull/${branch.pullRequest}`}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative z-10 mt-1 ml-6 flex min-w-0 max-w-fit items-center gap-1.5 text-muted-foreground text-xs"
                >
                  <GitPullRequest className="size-3 shrink-0" />
                  <span className="shrink-0">#{branch.pullRequest}</span>
                  <span className="truncate text-foreground/80 underline-offset-4 group-hover:text-foreground group-hover:underline">
                    {branch.pullRequestTitle ?? branch.gitBranch}
                  </span>
                </a>
              </TooltipTrigger>
              <TooltipContent className="font-mono">
                {branch.gitBranch}
              </TooltipContent>
            </Tooltip>
          ) : (
            <p className="mt-1 ml-6 flex items-center gap-1.5 text-muted-foreground text-xs">
              <SiGithub className="size-3 shrink-0" />
              <span className="font-mono">{branch.gitBranch}</span>
            </p>
          )}
        </div>

        {/* Status, then the actions as icons. */}
        <div className="relative z-10 flex shrink-0 items-center gap-2 pl-6 sm:pl-0">
          {/* The latest push: avatar on the left, then who on top and when
              under it. One block, since all of it describes the same moment.
              Left aligned in its own column, so it doesn't lean on the tags. */}
          <span className="hidden w-44 items-center gap-2 md:flex">
            <Avatar
              name={branch.lastPushBy ?? branch.createdBy}
              className="h-6 w-6"
              fallbackClassName="text-[11px] font-medium"
            />
            <span className="grid min-w-0 text-xs leading-tight">
              <span className="truncate">
                {branch.lastPushBy ?? branch.createdBy}
              </span>
              <span className="text-muted-foreground">
                pushed {timeAgo(branch.lastActivityAt)}
              </span>
            </span>
          </span>
          {/* Tags right aligned, in a column wide enough for the widest
              (Deploying), with room before it so no tag runs into the push
              block. */}
          <span className="ml-4 flex w-[6.5rem] justify-end">
            <BranchStatusMark status={branch.status} />
          </span>
          <RowAction
            label="Rename"
            icon={<Pencil />}
            disabled={branch.isProduction}
            tooltip={branch.isProduction ? "Can't rename production" : 'Rename'}
            onClick={() => setDialog({ kind: 'rename', branch })}
          />
          <RowAction
            label="View logs"
            icon={<FileText />}
            onClick={() => setDialog({ kind: 'logs', branch })}
          />
        </div>
      </li>
    );
  }

  /**
   * A pull request without a branch yet. Same columns as a branch row, so
   * the eye reads it as "almost a branch": who opened it and when where the
   * last push sits, its place in line where the status sits.
   */
  function renderWaitingRow(pr: WaitingPullRequest, index: number) {
    const position = index + 1;
    return (
      <li
        key={pr.pullRequest}
        className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
      >
        <div className="min-w-0 flex-1">
          {/* No branch name yet, so the pull request is the title. */}
          <a
            href={`https://github.com/${repository}/pull/${pr.pullRequest}`}
            target="_blank"
            rel="noreferrer"
            className="group flex min-w-0 max-w-fit items-center gap-2 text-sm"
          >
            <GitPullRequest className="size-4 shrink-0 text-muted-foreground" />
            <span className="shrink-0 text-muted-foreground">
              #{pr.pullRequest}
            </span>
            <span className="truncate font-medium underline-offset-4 group-hover:underline">
              {pr.title}
            </span>
          </a>
          <p className="mt-1 ml-6 flex items-center gap-1.5 text-muted-foreground text-xs">
            <SiGithub className="size-3 shrink-0" />
            <span className="truncate font-mono">{pr.gitBranch}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pl-6 sm:pl-0">
          <span className="hidden w-44 items-center gap-2 md:flex">
            <Avatar
              name={pr.openedBy}
              className="h-6 w-6"
              fallbackClassName="text-[11px] font-medium"
            />
            <span className="grid min-w-0 text-xs leading-tight">
              <span className="truncate">{pr.openedBy}</span>
              <span className="text-muted-foreground">
                opened {timeAgo(pr.openedAt)}
              </span>
            </span>
          </span>
          <span className="ml-4 flex w-[6.5rem] justify-end">
            <QueueMark position={position} />
          </span>
          {/* Holds the Rename spot so the last icon lines up with View
              logs on the branch rows. */}
          <span aria-hidden className="size-8" />
          <RowAction
            label="View GitHub comment"
            icon={<MessageSquare />}
            tooltip="GitHub comment"
            onClick={() =>
              setDialog({ kind: 'comment', pullRequest: pr, position })
            }
          />
        </div>
      </li>
    );
  }

  const close = (open: boolean) => !open && setDialog(null);

  return (
    <div className="grid gap-6">
      <section className="grid gap-2">
        <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Production
        </h2>
        {/* Production is the parent of every branch: the normal border and a
            very soft fill, a touch off the page background. */}
        <ul className="overflow-hidden rounded-lg border bg-muted/30">
          {renderRow(production)}
        </ul>
      </section>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Branches (
            {automaticBranching
              ? `${branchCount} of ${branchLimit}`
              : branchCount}
            )
          </h2>
          <InputGroup className="w-64">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Find a branch"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </InputGroup>
        </div>

        {/* Full, nobody waiting yet: a quiet heads up, not a warning. A
            full limit is the setting working, not something broken. */}
        {atLimit && waiting.length === 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
            <p className="text-muted-foreground text-sm">
              All {branchLimit} branches are in use. New pull requests will wait
              for one to free up.
            </p>
            <RaiseLimitLink />
          </div>
        )}

        {others.length > 0 ? (
          <ul className="divide-y overflow-hidden rounded-lg border">
            {others.map(renderRow)}
          </ul>
        ) : (
          <div className="grid place-items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
            <p className="font-medium text-sm">
              {search ? 'No branch with that name' : 'No branches yet'}
            </p>
            {!search && (
              <p className="max-w-sm text-muted-foreground text-sm">
                {automaticBranching
                  ? 'Open a pull request on GitHub and it gets its own branch here.'
                  : 'Automatic branching is off. Turn it on in Settings to get a branch for every pull request.'}
              </p>
            )}
          </div>
        )}
      </section>

      {waiting.length > 0 && (
        <section className="grid gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="grid gap-1">
              <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                Waiting for a branch ({waiting.length})
              </h2>
              <p className="max-w-xl text-muted-foreground text-sm">
                All {branchLimit} branches are in use. These pull requests get
                one in this order when another pull request closes or you raise
                the limit.
              </p>
            </div>
            <RaiseLimitLink />
          </div>
          {/* Dashed like other "not there yet" spots in the dashboard. */}
          <ul className="divide-y overflow-hidden rounded-lg border border-dashed">
            {waiting.map(renderWaitingRow)}
          </ul>
        </section>
      )}

      <RenameBranchDialog
        branch={dialog?.kind === 'rename' ? dialog.branch : null}
        open={dialog?.kind === 'rename'}
        onOpenChange={close}
      />
      <BranchLogsDialog
        branch={dialog?.kind === 'logs' ? dialog.branch : null}
        open={dialog?.kind === 'logs'}
        onOpenChange={close}
      />
      <PullRequestCommentDialog
        pullRequest={dialog?.kind === 'comment' ? dialog.pullRequest : null}
        position={dialog?.kind === 'comment' ? dialog.position : 0}
        open={dialog?.kind === 'comment'}
        onOpenChange={close}
      />
    </div>
  );
}
