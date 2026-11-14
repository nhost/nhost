import { Badge } from '@/components/ui/v3/badge';
import { supportLabel } from '@/features/support/utils/tickets';
import { cn } from '@/lib/utils';

export function TicketStatus({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'whitespace-nowrap',
        status === 'resolved' &&
          'border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
        status === 'closed' && 'text-muted-foreground',
        status === 'waiting_for_customer' &&
          'border-amber-500/30 text-amber-600 dark:text-amber-400',
      )}
    >
      {supportLabel(status)}
    </Badge>
  );
}

export function TicketSeverity({ severity }: { severity: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        'whitespace-nowrap',
        severity === 'urgent' && 'bg-red-500/10 text-red-600 dark:text-red-400',
        severity === 'high' &&
          'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      )}
    >
      {supportLabel(severity)}
    </Badge>
  );
}
