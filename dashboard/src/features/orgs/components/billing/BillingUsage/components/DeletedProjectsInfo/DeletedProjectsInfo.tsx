import { formatDeletedProjectCount } from '@/features/orgs/components/billing/BillingUsage/utils/formatDeletedProjectCount';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';

export interface DeletedProjectsInfoProps {
  count: number;
}

export default function DeletedProjectsInfo({
  count,
}: DeletedProjectsInfoProps) {
  return (
    <InfoTooltip>
      <div className="flex max-w-sm flex-col gap-1.5 text-xs">
        <p className="font-medium">{formatDeletedProjectCount(count)}</p>
        <p className="text-muted-foreground">
          Usage from projects that were deleted or moved to another
          organization, counted only while they belonged to this one.
        </p>
      </div>
    </InfoTooltip>
  );
}
