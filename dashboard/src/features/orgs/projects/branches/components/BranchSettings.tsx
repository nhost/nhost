import { useDummyBranches } from '@/features/orgs/projects/branches/dummy/useDummyBranches';
import { cn } from '@/lib/utils';

/**
 * Branch settings: for now only the branch limit, which comes from the backend
 * and can't be edited here. One card, so no card title (the page title says
 * it).
 */
export default function BranchSettings() {
  const { branchCount, branchLimit, repository } = useDummyBranches();

  return (
    <div className="grid gap-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-6">
        <div className="grid gap-1">
          <p className="font-medium text-sm">Branch limit</p>
          <p className="text-muted-foreground text-sm">
            Your plan includes {branchLimit} branches per project. Production
            doesn't count. Branches come from pull requests on{' '}
            <span className="font-mono">{repository}</span>.
          </p>
        </div>
        <p className="shrink-0 text-sm">
          {branchCount} of {branchLimit}
        </p>
      </div>
      {/* One slim segment per branch the plan allows, filled for each branch
          in use (like the cycle bar in the workspace widget). */}
      <div
        role="progressbar"
        aria-label="Branches used"
        aria-valuenow={branchCount}
        aria-valuemin={0}
        aria-valuemax={branchLimit}
        className="flex gap-[3px]"
      >
        {Array.from({ length: branchLimit }, (_, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed list of slots
            key={i}
            className={cn(
              'h-1 flex-1 rounded-sm',
              i < branchCount ? 'bg-primary' : 'bg-foreground/15',
            )}
          />
        ))}
      </div>
    </div>
  );
}
