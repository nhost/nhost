import { Badge } from '@/components/ui/v3/badge';
import { supportLabel, ticketStatusLabel } from '@/features/support/utils/tickets';
import { cn } from '@/lib/utils';

export function TicketStatus({ status, isAgent = false, dot = false }: { status: string; isAgent?: boolean; dot?: boolean }) {
  if (dot) {
    return (
      <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm">
        <span aria-hidden="true" className={cn(
          'size-1.5 shrink-0 rounded-full bg-muted-foreground',
          status === 'in_progress' && 'bg-primary',
          status === 'waiting_for_customer' && 'bg-brand-violet',
          status === 'resolved' && 'bg-success',
        )} />
        {ticketStatusLabel(status, isAgent)}
      </span>
    );
  }
  return (
    <Badge
      variant="outline"
      className={cn(
        'whitespace-nowrap',
        status === 'resolved' &&
          'border-success/30 text-success',
        status === 'closed' && 'text-muted-foreground',
        status === 'waiting_for_customer' &&
          'border-primary/30 text-primary',
      )}
    >
      {ticketStatusLabel(status, isAgent)}
    </Badge>
  );
}

export function TicketSeverity({ severity }: { severity: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        'whitespace-nowrap',
        severity === 'urgent' && 'bg-destructive/10 text-destructive',
        severity === 'high' &&
          'bg-primary/10 text-primary',
      )}
    >
      {supportLabel(severity)}
    </Badge>
  );
}
