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
 * Explains what is wrong with a service: the last error of a replica, or a
 * version that isn't one of the recommended ones. Renders nothing when the
 * service has no issue.
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

  if (service.isVersionMismatch) {
    return (
      <Alert variant="warning" className={cn('py-2.5 pr-3', className)}>
        <AlertTitle>Not a recommended version</AlertTitle>
        {service.recommendedVersion && (
          <AlertDescription className="text-muted-foreground text-xs">
            Recommended:{' '}
            <span className="font-mono">{service.recommendedVersion}</span>
          </AlertDescription>
        )}
      </Alert>
    );
  }

  return null;
}
