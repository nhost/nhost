import {
  ExternalLink,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import { MergeDialog } from '@/features/orgs/projects/branches/components/BranchDialogs';
import {
  type MergeRequest,
  type MergeRequestState,
  timeAgo,
  useDummyBranches,
} from '@/features/orgs/projects/branches/dummy/useDummyBranches';
import { cn } from '@/lib/utils';
import { triggerToast } from '@/utils/toast';

type Filter = MergeRequestState | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'merged', label: 'Merged' },
  { value: 'closed', label: 'Closed' },
  { value: 'all', label: 'All' },
];

const STATE_LABEL: Record<MergeRequestState, string> = {
  open: 'Open',
  merged: 'Merged',
  closed: 'Closed',
};

function StateIcon({ state }: { state: MergeRequestState }) {
  if (state === 'merged') {
    return <GitMerge className="size-4 shrink-0 text-muted-foreground" />;
  }
  if (state === 'closed') {
    return (
      <GitPullRequestClosed className="size-4 shrink-0 text-muted-foreground" />
    );
  }
  return <GitPullRequest className="size-4 shrink-0 text-primary" />;
}

export default function MergeRequests() {
  const { mergeRequests, branches, closeMergeRequest } = useDummyBranches();
  const [filter, setFilter] = useState<Filter>('open');
  const [merging, setMerging] = useState<MergeRequest | null>(null);

  const count = (f: Filter) =>
    f === 'all'
      ? mergeRequests.length
      : mergeRequests.filter((mr) => mr.state === f).length;

  const visible = mergeRequests
    .filter((mr) => filter === 'all' || mr.state === filter)
    .sort((a, b) => b.number - a.number);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            variant="outline"
            size="xs"
            aria-pressed={filter === f.value}
            className={cn(
              'rounded-full',
              filter === f.value &&
                'border-primary bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary',
            )}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
            <span
              className={cn(
                'ml-1.5',
                filter === f.value ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {count(f.value)}
            </span>
          </Button>
        ))}
      </div>

      {visible.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {visible.map((mr) => {
            const branch = branches.find((b) => b.name === mr.branchName);
            const viaGitHub = branch?.source === 'github';
            return (
              <li
                key={mr.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="mt-0.5">
                    <StateIcon state={mr.state} />
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2">
                      <span className="truncate font-medium text-sm">
                        {mr.title}
                      </span>
                      <span
                        className={cn(
                          'inline-flex shrink-0 rounded-full border px-2 py-px font-medium text-xs',
                          mr.state === 'open'
                            ? 'border-primary/40 text-primary'
                            : 'text-muted-foreground',
                        )}
                      >
                        {STATE_LABEL[mr.state]}
                      </span>
                    </p>
                    <p className="mt-1 truncate text-muted-foreground text-xs">
                      #{mr.number} ·{' '}
                      <span className="font-mono">{mr.branchName}</span> into{' '}
                      <span className="font-mono">{mr.into}</span> · {mr.author}
                      ,{' '}
                      {mr.state === 'open'
                        ? `opened ${timeAgo(mr.createdAt)}`
                        : `${STATE_LABEL[mr.state].toLowerCase()} ${timeAgo(mr.closedAt ?? mr.createdAt)}`}
                    </p>
                  </div>
                </div>

                {mr.state === 'open' && (
                  <div className="flex shrink-0 items-center gap-2 pl-7 sm:pl-0">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        closeMergeRequest(mr.id);
                        triggerToast(`Closed #${mr.number}`);
                      }}
                    >
                      Close
                    </Button>
                    {viaGitHub ? (
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
                    ) : (
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => setMerging(mr)}
                      >
                        Merge
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="grid place-items-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center">
          <p className="font-medium text-sm">
            No {filter === 'all' ? '' : `${filter} `}merge requests
          </p>
          <p className="max-w-sm text-muted-foreground text-sm">
            Open a merge request from a branch when its changes are ready for
            production.
          </p>
        </div>
      )}

      <MergeDialog
        request={merging}
        open={!!merging}
        onOpenChange={(open) => !open && setMerging(null)}
      />
    </div>
  );
}
