import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';

export interface DeletedProjectInfoProps {
  projectID: string;
}

export default function DeletedProjectInfo({
  projectID,
}: DeletedProjectInfoProps) {
  return (
    <InfoTooltip>
      <div className="flex max-w-sm flex-col gap-1.5 text-xs">
        <p className="font-medium">Deleted project</p>
        <p className="text-muted-foreground">
          This project was deleted or moved to another organization. Its usage
          while it belonged to this organization is still included here.
        </p>
        <p className="select-all font-mono">{projectID}</p>
      </div>
    </InfoTooltip>
  );
}
