import { useUI } from '@/context/UIContext';
import { Alert } from '@/ui/Alert';

export default function MaintenanceAlert() {
  const { maintenanceActive, maintenanceEndDate } = useUI();

  if (!maintenanceActive) {
    return null;
  }

  return (
    <Alert severity="warning" className="mt-4">
      <p>
        We&apos;re currently doing maintenance on our infrastructure. Project
        creation and project settings are temporarily disabled during the
        maintenance period.
      </p>

      {maintenanceEndDate && (
        <p>
          Maintenance is expected to be completed at{' '}
          {Intl.DateTimeFormat(undefined, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZoneName: 'short',
          }).format(maintenanceEndDate)}
          .
        </p>
      )}
    </Alert>
  );
}
