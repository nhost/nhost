import DeletedProjectInfo from '@/features/orgs/components/billing/BillingMetricsPreview/components/DeletedProjectInfo';
import { shortenProjectID } from '@/features/orgs/components/billing/BillingMetricsPreview/utils/formatBillingProject';
import { cn } from '@/lib/utils';

export interface BillingProjectLabelProps {
  projectID: string;
  projectName: string;
  isDeleted: boolean;
  className?: string;
}

export default function BillingProjectLabel({
  projectID,
  projectName,
  isDeleted,
  className,
}: BillingProjectLabelProps) {
  if (!isDeleted) {
    return <span className={className}>{projectName}</span>;
  }

  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)}>
      <span className="truncate">Deleted project</span>
      <code className="shrink-0 rounded border px-1.5 py-0.5 font-mono font-normal text-muted-foreground text-xs">
        {shortenProjectID(projectID)}
      </code>
      <DeletedProjectInfo projectIDs={[projectID]} />
    </span>
  );
}
