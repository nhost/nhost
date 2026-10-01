import { formatDeletedProjectCount } from '@/features/orgs/components/billing/BillingMetricsPreview/utils/formatBillingProject';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';

export type DeletedProjectInfoProps = { projectID: string } | { count: number };

export default function DeletedProjectInfo(props: DeletedProjectInfoProps) {
  return (
    <InfoTooltip>
      <div className="flex max-w-sm flex-col gap-1.5 text-xs">
        {'count' in props ? (
          <>
            <p className="font-medium">
              {formatDeletedProjectCount(props.count)}
            </p>
            <p className="text-muted-foreground">
              Usage from projects that were deleted or moved to another
              organization, counted only while they belonged to this one.
            </p>
          </>
        ) : (
          <>
            <p className="font-medium">Deleted project</p>
            <p className="text-muted-foreground">
              This project was deleted or moved to another organization. Its
              usage while it belonged to this organization is still included
              here.
            </p>
            <p className="select-all font-mono">{props.projectID}</p>
          </>
        )}
      </div>
    </InfoTooltip>
  );
}
