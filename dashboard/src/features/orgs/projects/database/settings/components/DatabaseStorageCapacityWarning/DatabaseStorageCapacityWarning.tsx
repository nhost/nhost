import { Alert } from '@/components/ui/v2/Alert';
import { Text } from '@/components/ui/v2/Text';
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
      <Alert severity="warning" className="flex flex-col gap-3 text-left">
        <div className="flex flex-col gap-2 lg:flex-row lg:justify-between">
          <Text className="flex items-start gap-1 font-semibold">
            <span>⚠</span> Warning: Increasing disk size
          </Text>
        </div>
        <div>
          <Text>
            Due to AWS limitations, disk size can only be modified once every 6
            hours. Please ensure you increase capacity sufficiently to cover
            your needs during this period.
          </Text>
        </div>
      </Alert>
    );
  }
  if (state === ApplicationStatus.Live && decreasingSize) {
    return (
      <Alert severity="warning" className="flex flex-col gap-3 text-left">
        <div className="flex flex-col gap-2 lg:flex-row lg:justify-between">
          <Text className="flex items-start gap-1 font-semibold">
            <span>⚠</span> Warning: Decreasing disk size requires project to be
            paused first.
          </Text>
        </div>
      </Alert>
    );
  }
  if (applicationPause && decreasingSize) {
    return (
      <Alert severity="warning" className="flex flex-col gap-3 text-left">
        <div className="flex flex-col gap-2 lg:flex-row lg:justify-between">
          <Text className="flex items-start gap-1 font-semibold">
            <span>⚠</span> Warning: Ensure enough space before downsizing.
          </Text>
        </div>
        <div>
          <Text>
            Before downsizing, ensure enough space for your database, WAL files,
            and other supporting data to prevent issues when unpausing your
            project.
          </Text>
        </div>
      </Alert>
    );
  }

  return null;
}
