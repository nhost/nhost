import { GitBranch, Loader2, Shield } from 'lucide-react';
import type {
  Branch,
  BranchStatus,
} from '@/features/orgs/projects/branches/dummy/useDummyBranches';
import { cn } from '@/lib/utils';

/**
 * Shield for production, branch glyph for everything else. The color only
 * changes when something is unusual, so it reads at a glance without turning
 * the whole list into colors:
 * - deploying or creating: blue, slow pulse (blue is "in progress" here)
 * - failed: red
 * - ready, paused or deleting: light gray (production keeps its blue shield)
 * `current` is the branch you're on (the header trigger): when it's ready it
 * takes the green of the "on a branch" strip. Color is never the only cue:
 * the status tags say the same in words.
 */
export function BranchIcon({
  branch,
  current = false,
  className,
}: {
  branch: Pick<Branch, 'isProduction' | 'status'>;
  current?: boolean;
  className?: string;
}) {
  const { status } = branch;
  const busy = status === 'creating' || status === 'deploying';
  const Icon = branch.isProduction ? Shield : GitBranch;

  return (
    <Icon
      className={cn(
        'size-4 shrink-0',
        busy && 'animate-pulse text-primary',
        status === 'failed' && 'text-destructive',
        status === 'ready' && branch.isProduction && 'text-primary',
        status === 'ready' && !branch.isProduction && current && 'text-success',
        // Quiet light gray for everything else.
        ((status === 'ready' && !branch.isProduction && !current) ||
          status === 'paused' ||
          status === 'deleting') &&
          'text-muted-foreground opacity-50',
        className,
      )}
    />
  );
}

export function ProductionBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border border-primary/40 bg-primary/10 px-2 py-px font-medium text-primary text-xs',
        className,
      )}
    >
      Production
    </span>
  );
}

export function CurrentBadge() {
  return (
    // Same green as the "on a branch" strip at the top.
    <span className="inline-flex shrink-0 items-center rounded-full border border-success/40 px-2 py-px font-medium text-success text-xs">
      You're here
    </span>
  );
}

const STATUS_LABEL: Record<BranchStatus, string> = {
  creating: 'Creating',
  deploying: 'Deploying',
  ready: 'Ready',
  failed: 'Failed',
  paused: 'Paused',
  deleting: 'Deleting',
};

/**
 * The branch's status as a tag, same shape as the other tags. Ready, paused
 * and deleting stay quiet (gray), creating and deploying are blue like
 * anything in progress, failed is red. `hideReady` drops Ready in tight spots
 * like the header dropdown.
 */
export function BranchStatusMark({
  status,
  hideReady = false,
}: {
  status: BranchStatus;
  hideReady?: boolean;
}) {
  if (status === 'ready' && hideReady) {
    return null;
  }

  const busy = status === 'creating' || status === 'deploying';

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-px font-medium text-xs',
        busy
          ? 'border-primary/40 bg-primary/10 text-primary'
          : status === 'failed'
            ? 'border-destructive/40 bg-destructive/10 text-destructive'
            : 'bg-muted text-muted-foreground',
      )}
    >
      {busy || status === 'deleting' ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <span
          className={cn(
            'size-1.5 rounded-full',
            status === 'failed' ? 'bg-destructive' : 'bg-muted-foreground',
          )}
        />
      )}
      {STATUS_LABEL[status]}
    </span>
  );
}
