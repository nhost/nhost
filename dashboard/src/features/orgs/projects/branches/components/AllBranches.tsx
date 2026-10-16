import {
  Clock,
  ExternalLink,
  FileText,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { type ReactNode, useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
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
import { cn } from '@/lib/utils';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';
import { triggerToast } from '@/utils/toast';

type DialogState =
  | { kind: 'logs' | 'open-request'; branch: Branch }
  | { kind: 'delete'; branches: Branch[] }
  | { kind: 'merge'; request: MergeRequest }
  | null;

interface RowActionProps {
  label: string;
  icon: ReactNode;
  tooltip?: ReactNode;
  disabled?: boolean;
  href?: string;
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
  href,
  onClick,
}: RowActionProps) {
  const button = href ? (
    <Button asChild variant="outline" size="icon-sm" aria-label={label}>
      <a href={href} target="_blank" rel="noreferrer">
        {icon}
      </a>
    </Button>
  ) : (
    <Button
      variant="outline"
      size="icon-sm"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* The span keeps the tooltip working on disabled buttons. */}
        <span className="inline-flex">{button}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-60">{tooltip ?? label}</TooltipContent>
    </Tooltip>
  );
}

export default function AllBranches() {
  const router = useRouter();
  const orgSlug = getSingleQueryParam(router.query.orgSlug);
  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);
  const { branches, production, currentBranch, openRequestFor, switchTo } =
    useDummyBranches();
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<DialogState>(null);
  // Bulk delete: "Select" turns on selecting, which shows the checkboxes.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
  }

  const others = branches
    .filter((b) => !b.isProduction)
    .filter((b) => b.name.includes(search.trim().toLowerCase()));

  // Production and the branch you're on can't be deleted, so they can't be
  // selected either.
  const selectable = others.filter((b) => b.id !== currentBranch.id);
  const selectedBranches = selectable.filter((b) => selected.has(b.id));
  const inactive = selectable.filter(isStale);
  const allSelected =
    selectable.length > 0 && selectedBranches.length === selectable.length;

  function toggle(branchId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(branchId);
      } else {
        next.delete(branchId);
      }
      return next;
    });
  }

  const newBranchHref = `/orgs/${orgSlug}/projects/${appSubdomain}/branches?tab=new`;

  function renderRow(branch: Branch) {
    const isCurrent = branch.id === currentBranch.id;
    const request = openRequestFor(branch.name);
    const stale = isStale(branch);
    const busy = branch.status !== 'ready';
    // The whole row opens the branch (except the one you're on).
    const canSelect = !branch.isProduction && !isCurrent;
    // Normally a click on the row opens the branch; while selecting, it
    // selects it instead. The branch you're on does neither.
    const clickable = selecting ? canSelect : !isCurrent && !busy;

    return (
      <li
        key={branch.id}
        className={cn(
          'relative flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3',
          clickable && 'cursor-pointer hover:bg-accent',
        )}
      >
        {clickable && (
          // Covers the row so a click anywhere acts on it. The tags with
          // tooltips, the checkbox and the actions sit above it (z-10).
          <button
            type="button"
            aria-label={
              selecting ? `Select ${branch.name}` : `Open ${branch.name}`
            }
            className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            onClick={() => {
              if (selecting) {
                toggle(branch.id, !selected.has(branch.id));
                return;
              }
              switchTo(branch.id);
              triggerToast(`Opened ${branch.name}`);
            }}
          />
        )}
        {/* Checkboxes only while selecting; production never gets one. */}
        {selecting && !branch.isProduction && (
          <div className="relative z-10 flex w-4 shrink-0 justify-center">
            {canSelect && (
              <Checkbox
                checked={selected.has(branch.id)}
                onCheckedChange={(checked) =>
                  toggle(branch.id, checked === true)
                }
                aria-label={`Select ${branch.name}`}
              />
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <BranchIcon branch={branch} />
            <span className="truncate font-medium font-mono text-sm">
              {branch.name}
            </span>
            {branch.isProduction && <ProductionBadge />}
            {branch.source === 'github' && (
              <span className="relative z-10 flex">
                <GitHubMirrorMark gitBranch={branch.gitBranch} />
              </span>
            )}
            {request && (
              <span className="relative z-10 flex">
                <OpenRequestChip request={request} />
              </span>
            )}
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

        {/* Merge action as text, then View logs as an icon, always last. */}
        <div className="relative z-10 flex shrink-0 items-center gap-2 pl-6 sm:pl-0">
          {!branch.isProduction &&
            (branch.source === 'github' ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button asChild variant="outline" size="xs">
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
                  <span className="font-mono">{branch.gitBranch}</span>, so it
                  merges through its pull request on GitHub.
                </TooltipContent>
              </Tooltip>
            ) : request ? (
              <Button
                variant="outline"
                size="xs"
                disabled={busy}
                onClick={() => setDialog({ kind: 'merge', request })}
              >
                Merge
              </Button>
            ) : (
              <Button
                variant="outline"
                size="xs"
                disabled={busy}
                onClick={() => setDialog({ kind: 'open-request', branch })}
              >
                Open merge request
              </Button>
            ))}

          <RowAction
            label="View logs"
            icon={<FileText />}
            onClick={() => setDialog({ kind: 'logs', branch })}
          />
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
        <ul className="overflow-hidden rounded-lg border">
          {renderRow(production)}
        </ul>
      </section>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Branches ({branches.length - 1})
          </h2>
          <div className="flex items-center gap-2">
            {selectable.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  selecting ? stopSelecting() : setSelecting(true)
                }
              >
                {selecting ? 'Done' : 'Select'}
              </Button>
            )}
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
          <ul className="divide-y overflow-hidden rounded-lg border">
            {/* While selecting: select all, a count, and the bulk actions. */}
            {selecting && (
              <li className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-sm">
                <div className="flex w-4 shrink-0 justify-center">
                  <Checkbox
                    checked={
                      allSelected
                        ? true
                        : selectedBranches.length > 0
                          ? 'indeterminate'
                          : false
                    }
                    disabled={selectable.length === 0}
                    onCheckedChange={() =>
                      setSelected(
                        allSelected
                          ? new Set()
                          : new Set(selectable.map((b) => b.id)),
                      )
                    }
                    aria-label="Select all branches"
                  />
                </div>
                <span className="flex-1 text-muted-foreground">
                  {selectedBranches.length > 0
                    ? `${selectedBranches.length} selected`
                    : 'Select the branches to delete'}
                </span>
                <div className="flex items-center gap-2">
                  {inactive.length > 0 && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() =>
                        setSelected(new Set(inactive.map((b) => b.id)))
                      }
                    >
                      Select inactive ({inactive.length})
                    </Button>
                  )}
                  {selectedBranches.length > 0 && (
                    <>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setSelected(new Set())}
                      >
                        Clear
                      </Button>
                      <Button
                        variant="destructive"
                        size="xs"
                        onClick={() =>
                          setDialog({
                            kind: 'delete',
                            branches: selectedBranches,
                          })
                        }
                      >
                        <Trash2 className="mr-1.5 size-3.5" />
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </li>
            )}
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
        branches={dialog?.kind === 'delete' ? dialog.branches : []}
        open={dialog?.kind === 'delete'}
        onOpenChange={close}
        onDeleted={stopSelecting}
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
