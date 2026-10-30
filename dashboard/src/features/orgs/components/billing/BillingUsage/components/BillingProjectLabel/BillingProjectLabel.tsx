import { DeletedProjectInfo } from '@/features/orgs/components/billing/BillingUsage/components/DeletedProjectInfo';
import { shortenProjectID } from '@/features/orgs/components/billing/BillingUsage/utils/shortenProjectID';

export interface BillingProjectLabelProps {
  projectID: string;
  projectName: string;
  isDeleted: boolean;
}

export default function BillingProjectLabel({
  projectID,
  projectName,
  isDeleted,
}: BillingProjectLabelProps) {
  if (!isDeleted) {
    return <span>{projectName}</span>;
  }

  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="truncate">Deleted project</span>
      <code className="shrink-0 rounded border px-1.5 py-0.5 font-mono font-normal text-muted-foreground text-xs">
        {shortenProjectID(projectID)}
      </code>
      <DeletedProjectInfo projectID={projectID} />
    </span>
  );
}
