import { Alert, AlertDescription } from '@/components/ui/v3/alert';

function PiTREnabledInfoBanner() {
  return (
    <Alert>
      <AlertDescription>
        With Point-in-Time Recovery enabled, Scheduled backups are no longer
        taken. Point-in-Time Recovery provides more precise recovery, making
        additional backups unnecessary.
      </AlertDescription>
    </Alert>
  );
}

export default PiTREnabledInfoBanner;
