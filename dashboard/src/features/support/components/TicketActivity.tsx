import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import {
  TicketSeverity,
  TicketStatus,
} from '@/features/support/components/TicketBadges';
import { supportDate, supportLabel } from '@/features/support/utils/tickets';
import type { DashboardSupportEventsQuery } from '@/generated/graphql';

function renderChangeValue(kind: string, value: string | null | undefined) {
  if (!value) {
    return 'None';
  }
  if (kind === 'status_changed') {
    return <TicketStatus status={value} isAgent />;
  }
  if (kind === 'severity_changed') {
    return <TicketSeverity severity={value} />;
  }
  return supportLabel(value);
}

export default function TicketActivity({
  events,
}: {
  events: DashboardSupportEventsQuery['supportTicketEvents'];
}) {
  return (
    <section aria-label="Ticket activity" className="min-w-0 space-y-3">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col" className="px-2 text-foreground">
              When
            </TableHead>
            <TableHead scope="col" className="text-foreground">
              Who
            </TableHead>
            <TableHead scope="col" className="text-foreground">
              What
            </TableHead>
            <TableHead scope="col" className="text-foreground">
              Change
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => (
            <TableRow key={event.id}>
              <TableCell className="whitespace-nowrap px-2 text-muted-foreground">
                <time dateTime={event.createdAt}>
                  {supportDate(event.createdAt)}
                </time>
              </TableCell>
              <TableCell>{event.actorName}</TableCell>
              <TableCell>{supportLabel(event.kind)}</TableCell>
              <TableCell className="break-words">
                <div className="flex flex-wrap items-center gap-2">
                  {renderChangeValue(event.kind, event.oldValue)}
                  <span className="text-muted-foreground">→</span>
                  {renderChangeValue(event.kind, event.newValue)}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-muted-foreground text-xs">
        Showing the latest 100 events.
      </p>
    </section>
  );
}
