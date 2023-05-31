import { useUI } from '@/components/common/UIProvider';
import { Alert } from '@/components/ui/v2/Alert';

export default function MaintenanceAlert() {
  const { maintenanceActive, maintenanceEndDate } = useUI();

  if (!maintenanceActive) {
    return null;
  }

  const dateTimeFormat = Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZoneName: 'short',
  });

  const parts = dateTimeFormat.formatToParts(maintenanceEndDate);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  const hour = parts.find((part) => part.type === 'hour')?.value;
  const minute = parts.find((part) => part.type === 'minute')?.value;
  const timeZone = parts.find((part) => part.type === 'timeZoneName')?.value;

  return (
    <Alert severity="warning" className="mt-4">
      <p>
        We&apos;re currently doing maintenance on our infrastructure. Project
        creation and project settings are temporarily disabled during the
        maintenance period.
      </p>

      {maintenanceEndDate && (
        <p>
          Maintenance is expected to be completed at {year}-{month}-{day} {hour}
          :{minute} {timeZone}.
        </p>
      )}
    </Alert>
  );
}
