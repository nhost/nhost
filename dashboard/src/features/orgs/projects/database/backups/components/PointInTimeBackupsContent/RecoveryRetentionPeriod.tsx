import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';

function RecoveryRetentionPeriod() {
  return (
    <Alert>
      <AlertTitle>Recovery retention period</AlertTitle>
      <AlertDescription>
        Database changes are retained for up to 7 days, allowing restoration to
        any point within this period.
      </AlertDescription>
    </Alert>
  );
}

export default RecoveryRetentionPeriod;
