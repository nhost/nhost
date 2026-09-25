import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import {
  formatDeletedProjectCount,
  shortenProjectID,
} from '@/features/orgs/components/billing/BillingMetricsPreview/utils/formatBillingProject';

const MAX_LISTED_PROJECT_IDS = 10;

export interface DeletedProjectInfoProps {
  projectIDs: string[];
}

export default function DeletedProjectInfo({
  projectIDs,
}: DeletedProjectInfoProps) {
  const isGroup = projectIDs.length > 1;
  const listedProjectIDs = projectIDs.slice(0, MAX_LISTED_PROJECT_IDS);
  const unlistedCount = projectIDs.length - listedProjectIDs.length;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex shrink-0 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={
            isGroup
              ? `About ${formatDeletedProjectCount(projectIDs.length)}`
              : `About deleted project ${shortenProjectID(projectIDs[0])}`
          }
        >
          <Info aria-hidden className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="flex max-w-sm flex-col gap-1.5 text-xs">
        <p className="font-medium">
          {isGroup
            ? formatDeletedProjectCount(projectIDs.length)
            : 'Deleted project'}
        </p>
        <p className="text-muted-foreground">
          {isGroup
            ? 'These projects were deleted or moved to another organization. Their usage while they belonged to this organization is still included here, grouped into a single series.'
            : 'This project was deleted or moved to another organization. Its usage while it belonged to this organization is still included here.'}
        </p>
        <ul className="flex flex-col gap-0.5 font-mono">
          {listedProjectIDs.map((projectID) => (
            <li key={projectID} className="select-all">
              {projectID}
            </li>
          ))}
          {unlistedCount > 0 ? (
            <li className="font-sans text-muted-foreground">
              +{unlistedCount} more
            </li>
          ) : null}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
