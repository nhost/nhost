import { CircleDashed, CirclePause, Clock } from 'lucide-react';
import {
  SEVERITIES,
  supportLabel,
  ticketStatusLabel,
} from '@/features/support/utils/tickets';
import { cn } from '@/lib/utils';

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'closed':
    case 'resolved':
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={cn(
            'size-4 shrink-0',
            status === 'resolved' ? 'text-success' : 'text-muted-foreground',
          )}
        >
          <path
            fill="currentColor"
            fillRule="evenodd"
            d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm5 7.5-6.25 6.25L7 12l1.4-1.4 2.35 2.35L15.6 8.1 17 9.5Z"
          />
        </svg>
      );
    case 'waiting_for_customer':
      return (
        <CirclePause
          aria-hidden="true"
          className="size-4 shrink-0 text-warning-foreground"
        />
      );
    case 'in_progress':
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-4 shrink-0 text-primary"
        >
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" />
        </svg>
      );
    case 'waiting_for_support':
      return (
        <Clock
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
      );
    default:
      return (
        <CircleDashed
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
      );
  }
}

export function TicketStatus({
  status,
  isAgent = false,
}: {
  status: string;
  isAgent?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-foreground text-sm">
      <StatusIcon status={status} />
      {ticketStatusLabel(status, isAgent)}
    </span>
  );
}

const severityBars = [
  { x: 1, height: 4 },
  { x: 5, height: 7 },
  { x: 9, height: 10 },
  { x: 13, height: 13 },
];

export function TicketSeverity({ severity }: { severity: string }) {
  const filledBars = SEVERITIES.findIndex((level) => level === severity) + 1;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 whitespace-nowrap text-sm',
        severity === 'urgent' ? 'text-destructive' : 'text-foreground',
      )}
    >
      <svg aria-hidden="true" viewBox="0 0 17 16" className="size-4 shrink-0">
        {severityBars.map(({ x, height }, index) => (
          <rect
            key={x}
            x={x}
            y={15 - height}
            width="3"
            height={height}
            rx="0.5"
            fill="currentColor"
            className={
              index >= filledBars
                ? 'text-muted-foreground opacity-30'
                : undefined
            }
          />
        ))}
      </svg>
      {supportLabel(severity)}
    </span>
  );
}
