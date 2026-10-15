import { SiGithub } from '@icons-pack/react-simple-icons';
import { GitBranch, GitPullRequest, Loader2, Shield } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import type {
  Branch,
  MergeRequest,
} from '@/features/orgs/projects/branches/dummy/useDummyBranches';
import { cn } from '@/lib/utils';

/** Shield for production, branch glyph for everything else. */
export function BranchIcon({
  branch,
  className,
}: {
  branch: Pick<Branch, 'isProduction'>;
  className?: string;
}) {
  return branch.isProduction ? (
    <Shield className={cn('size-4 shrink-0 text-primary', className)} />
  ) : (
    <GitBranch
      className={cn('size-4 shrink-0 text-muted-foreground', className)}
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
    <span className="inline-flex shrink-0 items-center rounded-full border px-2 py-px font-medium text-muted-foreground text-xs">
      You're here
    </span>
  );
}

export function GitHubMirrorMark({ gitBranch }: { gitBranch?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex shrink-0 items-center text-muted-foreground">
          <SiGithub className="size-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="pointer-events-none max-w-60">
        <p className="font-medium">Mirrors a GitHub branch</p>
        <p className="text-muted-foreground">
          Every push to <span className="font-mono">{gitBranch}</span> deploys
          to this branch.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export function OpenRequestChip({
  request,
  compact = false,
}: {
  request: MergeRequest;
  /** Icon only, for tight spots like the header dropdown. */
  compact?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {compact ? (
          <span
            role="img"
            aria-label={`Open merge request #${request.number}`}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-primary/40 text-primary"
          >
            <GitPullRequest className="size-3" />
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/40 px-1.5 py-px font-medium text-primary text-xs">
            <GitPullRequest className="size-3" />#{request.number}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent className="pointer-events-none max-w-60">
        <p className="font-medium">Open merge request #{request.number}</p>
        <p className="text-muted-foreground">{request.title}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function BranchStatusMark({ branch }: { branch: Branch }) {
  if (branch.status === 'creating') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-muted-foreground text-xs">
        <Loader2 className="size-3 animate-spin" />
        Creating
      </span>
    );
  }
  if (branch.status === 'failed') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-destructive text-xs">
        <span className="size-1.5 rounded-full bg-destructive" />
        Failed
      </span>
    );
  }
  return null;
}
