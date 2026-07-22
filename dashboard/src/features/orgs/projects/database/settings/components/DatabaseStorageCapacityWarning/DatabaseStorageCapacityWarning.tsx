import { Alert } from '@/components/ui/v3/alert';
import { ApplicationStatus } from '@/types/application';

interface DatabaseStorageCapacityWarningProps {
  state: ApplicationStatus;
  decreasingSize: boolean;
  isDirty: boolean;
}

export default function DatabaseStorageCapacityWarning({
  state,
  decreasingSize,
  isDirty,
}: DatabaseStorageCapacityWarningProps) {
  const applicationPause =
    state === ApplicationStatus.Paused || state === ApplicationStatus.Pausing;

  if (!isDirty) {
    return null;
  }

  if (state === ApplicationStatus.Live && !decreasingSize) {
    return (
      <Alert className="flex flex-col gap-3 text-left">
        <div className="flex flex-col gap-2 lg:flex-row lg:justify-between">
          <p className="flex items-start gap-1 font-semibold">
            <span>⚠</span> Warning: Increasing disk size
          </p>
        </div>
        <div>
          <p>
            Due to AWS limitations, disk size can only be modified once every 6
            hours. Please ensure you increase capacity sufficiently to cover
            your needs during this period.
          </p>
        </div>
      </Alert>
    );
  }
  if (state === ApplicationStatus.Live && decreasingSize) {
    return (
      <Alert className="flex flex-col gap-3 text-left">
        <div className="flex flex-col gap-2 lg:flex-row lg:justify-between">
          <p className="flex items-start gap-1 font-semibold">
            <span>⚠</span> Warning: Decreasing disk size requires project to be
            paused first.
          </p>
        </div>
      </Alert>
    );
  }
  if (applicationPause && decreasingSize) {
    return (
      <Alert className="flex flex-col gap-3 text-left">
        <div className="flex flex-col gap-2 lg:flex-row lg:justify-between">
          <p className="flex items-start gap-1 font-semibold">
            <span>⚠</span> Warning: Ensure enough space before downsizing.
          </p>
        </div>
        <div>
          <p>
            Before downsizing, ensure enough space for your database, WAL files,
            and other supporting data to prevent issues when unpausing your
            project.
          </p>
        </div>
      </Alert>
    );
  }

  return null;
}
