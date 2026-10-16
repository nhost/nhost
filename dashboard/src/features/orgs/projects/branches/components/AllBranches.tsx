import {
  Clock,
  ExternalLink,
  FileText,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
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
  GitHubMirrorMark,
  OpenRequestChip,
  ProductionBadge,
} from '@/features/orgs/projects/branches/components/BranchBits';
import {
  BranchLogsDialog,
  DeleteBranchDialog,
  MergeDialog,
  OpenRequestDialog,
} from '@/features/orgs/projects/branches/components/BranchDialogs';
import {
  type Branch,
  isStale,
  type MergeRequest,
  timeAgo,
  useDummyBranches,
} from '@/features/orgs/projects/branches/dummy/useDummyBranches';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';
import { triggerToast } from '@/utils/toast';

type DialogState =
  | { kind: 'delete' | 'logs' | 'open-request'; branch: Branch }
  | { kind: 'merge'; request: MergeRequest }
  | null;

export default function AllBranches() {
  const router = useRouter();
  const orgSlug = getSingleQueryParam(router.query.orgSlug);
  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);
  const { branches, production, currentBranch, openRequestFor, switchTo } =
    useDummyBranches();
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<DialogState>(null);

  const others = branches
    .filter((b) => !b.isProduction)
    .filter((b) => b.name.includes(search.trim().toLowerCase()));

  const newBranchHref = `/orgs/${orgSlug}/projects/${appSubdomain}/branches?tab=new`;

  function renderRow(branch: Branch) {
    const isCurrent = branch.id === currentBranch.id;
    const request = openRequestFor(branch.name);
    const stale = isStale(branch);
    const busy = branch.status !== 'ready';

    return (
      <li
        key={branch.id}
        className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
      >
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <BranchIcon branch={branch} />
            <span className="truncate font-medium font-mono text-sm">
              {branch.name}
            </span>
            {branch.isProduction && <ProductionBadge />}
            {branch.source === 'github' && (
              <GitHubMirrorMark gitBranch={branch.gitBranch} />
            )}
            {request && <OpenRequestChip request={request} />}
            {isCurrent && <CurrentBadge />}
            <BranchStatusMark branch={branch} />
          </div>
          <p className="mt-1 truncate pl-6 text-muted-foreground text-xs">
            {branch.isProduction ? (
              <>
                Created with the project · Updated{' '}
                {timeAgo(branch.lastActivityAt)}
              </>
            ) : (
              <>
                From <span className="font-mono">{branch.branchedFrom}</span> ·{' '}
                {branch.createdBy}, {timeAgo(branch.createdAt)}
                {branch.source === 'github' && (
                  <>
                    {' '}
                    · Mirrors{' '}
                    <span className="font-mono">{branch.gitBranch}</span>
                  </>
                )}
                {stale ? (
                  <span className="ml-1 inline-flex items-center gap-1 text-warning">
                    · <Clock className="size-3" /> No activity for{' '}
                    {timeAgo(branch.lastActivityAt).replace(' ago', '')}
                  </span>
                ) : (
                  <> · Updated {timeAgo(branch.lastActivityAt)}</>
                )}
              </>
            )}
          </p>
        </div>

        {/* Fixed slots (Open, merge action, more) keep buttons aligned
            across rows. A slot stays empty when its action doesn't apply. */}
        <div className="flex shrink-0 items-center gap-2 pl-6 sm:pl-0">
          <div className="flex w-16 justify-end">
            {!isCurrent && (
              <Button
                variant="outline"
                size="xs"
                className="w-full"
                disabled={busy}
                onClick={() => {
                  switchTo(branch.id);
                  triggerToast(`Opened ${branch.name}`);
                }}
              >
                Open
              </Button>
            )}
          </div>

          <div className="flex w-40">
            {!branch.isProduction &&
              (branch.source === 'github' ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      asChild
                      variant="outline"
                      size="xs"
                      className="w-full"
                    >
                      <a
                        href="https://github.com"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Merge on GitHub
                        <ExternalLink className="ml-1.5 size-3.5" />
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-60">
                    This branch mirrors{' '}
                    <span className="font-mono">{branch.gitBranch}</span>, so
                    it merges through its pull request on GitHub.
                  </TooltipContent>
                </Tooltip>
              ) : request ? (
                <Button
                  variant="outline"
                  size="xs"
                  className="w-full"
                  disabled={busy}
                  onClick={() => setDialog({ kind: 'merge', request })}
                >
                  Merge
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="xs"
                  className="w-full"
                  disabled={busy}
                  onClick={() => setDialog({ kind: 'open-request', branch })}
                >
                  Open merge request
                </Button>
              ))}
          </div>

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="subtle"
                    aria-label={`More actions for ${branch.name}`}
                  >
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>More actions</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => setDialog({ kind: 'logs', branch })}
              >
                <FileText className="mr-2 size-4" />
                View logs
              </DropdownMenuItem>
              {!branch.isProduction && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setDialog({ kind: 'delete', branch })}
                  >
                    <Trash2 className="mr-2 size-4" />
                    Delete branch
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </li>
    );
  }

  const branchFor = (kind: string) =>
    dialog && dialog.kind === kind && 'branch' in dialog ? dialog.branch : null;
  const close = (open: boolean) => !open && setDialog(null);

  return (
    <div className="grid gap-6">
      <section className="grid gap-2">
        <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Production
        </h2>
        <ul className="rounded-lg border">{renderRow(production)}</ul>
      </section>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Branches ({branches.length - 1})
          </h2>
          <div className="flex items-center gap-2">
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
            <Button asChild size="sm">
              <Link href={newBranchHref}>
                <Plus className="mr-1.5 size-4" />
                New branch
              </Link>
            </Button>
          </div>
        </div>

        {others.length > 0 ? (
          <ul className="divide-y rounded-lg border">
            {others.map(renderRow)}
          </ul>
        ) : (
          <div className="grid place-items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
            <p className="font-medium text-sm">
              {search ? 'No branch with that name' : 'No branches yet'}
            </p>
            {!search && (
              <p className="max-w-sm text-muted-foreground text-sm">
                Create a branch to try changes without touching production.
              </p>
            )}
          </div>
        )}
      </section>

      <DeleteBranchDialog
        branch={branchFor('delete')}
        open={dialog?.kind === 'delete'}
        onOpenChange={close}
      />
      <BranchLogsDialog
        branch={branchFor('logs')}
        open={dialog?.kind === 'logs'}
        onOpenChange={close}
      />
      <OpenRequestDialog
        branch={branchFor('open-request')}
        open={dialog?.kind === 'open-request'}
        onOpenChange={close}
      />
      <MergeDialog
        request={dialog?.kind === 'merge' ? dialog.request : null}
        open={dialog?.kind === 'merge'}
        onOpenChange={close}
      />
    </div>
  );
}
