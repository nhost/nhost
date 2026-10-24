import { ArrowUp, TriangleAlert } from 'lucide-react';
import { DeploymentRollbackNotes } from '@/features/orgs/projects/deployments/components/DeploymentRollbackNotes';
import { describeCommitRelation } from '@/features/orgs/projects/deployments/utils/commit-relation';
import type { GitHubComparison } from '@/lib/github';
import { cn } from '@/lib/utils';

interface CommitRelationProps {
  comparing: boolean;
  comparison: GitHubComparison | undefined;
  compareFailed: boolean;
  olderThanLive: boolean;
}

export default function CommitRelation({
  comparing,
  comparison,
  compareFailed,
  olderThanLive,
}: CommitRelationProps) {
  if (comparing) {
    return (
      <p className="text-muted-foreground text-xs">
        Comparing with the live deployment...
      </p>
    );
  }
  const relation = comparison
    ? describeCommitRelation({
        ...comparison,
        identical: comparison.status === 'identical',
      })
    : null;
  if (!relation && !compareFailed && !olderThanLive) {
    return null;
  }
  const warning = olderThanLive || compareFailed || relation?.warning;
  let text = relation?.text;
  if (compareFailed) {
    text = "Couldn't compare with the live deployment";
  }
  if (olderThanLive) {
    text = 'Older than the live deployment';
  }

  return (
    <div className="grid gap-2">
      <p
        className={cn(
          'flex items-center gap-1.5 text-xs',
          warning ? 'text-warning' : 'text-muted-foreground',
        )}
      >
        {warning ? (
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ArrowUp className="h-3.5 w-3.5 shrink-0" />
        )}
        {text}
      </p>
      {warning && <DeploymentRollbackNotes />}
    </div>
  );
}
