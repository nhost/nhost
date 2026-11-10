import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import type { OverviewService } from '@/features/orgs/projects/overview/hooks/useOverviewServices';
import { cn } from '@/lib/utils';

export interface ServiceIssueAlertProps {
  service: OverviewService;
  className?: string;
}

function getLastError(service: OverviewService) {
  return service.status?.replicas
    .flatMap((replica) => replica.errors)
    .find((error) => error.lastError)?.lastError;
}

/**
 * Shows the last error of a replica. Renders nothing when there is none.
 * Version updates aren't errors: they show as a small icon by the version.
 */
export default function ServiceIssueAlert({
  service,
  className,
}: ServiceIssueAlertProps) {
  const lastError = getLastError(service);

  if (lastError) {
    return (
      <Alert
        variant="destructive"
        className={cn('py-2.5 pr-3 text-foreground', className)}
      >
        <AlertTitle>{lastError.reason}</AlertTitle>
        <AlertDescription className="break-words text-muted-foreground text-xs">
          Exit code {lastError.exitCode}
          {lastError.message ? `: ${lastError.message}` : ''}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
