import { Button } from '@/components/ui/v3/button';
import { Skeleton } from '@/components/ui/v3/skeleton';

export function CronJobsSidebarLoading() {
  return (
    <div className="flex flex-col gap-3 p-2.5" aria-busy="true">
      <div className="space-y-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <div className="space-y-1">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

export function CronJobsSidebarError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: VoidFunction;
}) {
  return (
    <div className="flex flex-col items-start gap-1 p-2.5 text-sm">
      <p className="text-muted-foreground">{message}</p>
      <Button variant="link" size="inline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
