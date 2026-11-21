import { useQuery } from '@tanstack/react-query';
import { Spinner } from '@/components/ui/v3/spinner';
import { SupportError } from '@/features/support/components/SupportArea';
import { useSupportSession } from '@/features/support/hooks/use-support-session';
import { supportDate, supportLabel } from '@/features/support/utils/tickets';
import {
  DashboardSupportEventsDocument,
  type DashboardSupportEventsQuery,
} from '@/generated/graphql';

export default function TicketActivity({ ticketId }: { ticketId: string }) {
  const { queryKey, request } = useSupportSession();
  const events = useQuery({
    queryKey: [...queryKey, 'events', ticketId],
    queryFn: ({ signal }) =>
      request<DashboardSupportEventsQuery>(
        DashboardSupportEventsDocument,
        { id: ticketId },
        signal,
      ),
    cacheTime: 0,
    retry: false,
    refetchInterval: 30000,
  });
  return (
    <section aria-label="Ticket activity" className="space-y-4 border-t pt-5">
      <h2 className="font-semibold text-sm">Activity</h2>
      {events.isError ? (
        <SupportError
          message="Unable to load ticket activity."
          retry={() => {
            void events.refetch();
          }}
        />
      ) : events.isLoading ? (
        <Spinner>Loading activity…</Spinner>
      ) : (
        <ol className="space-y-4">
          {events.data?.supportTicketEvents.map((event) => (
            <li key={event.id} className="text-muted-foreground text-xs">
              <p>
                <span className="font-medium text-foreground">
                  {event.actorName}
                </span>{' '}
                · {supportLabel(event.kind)}
              </p>
              {(event.oldValue || event.newValue) && (
                <p className="mt-1 break-words">
                  {event.oldValue ? supportLabel(event.oldValue) : '—'} →{' '}
                  {event.newValue ? supportLabel(event.newValue) : '—'}
                </p>
              )}
              <time dateTime={event.createdAt} className="mt-1 block">
                {supportDate(event.createdAt)}
              </time>
            </li>
          ))}
        </ol>
      )}
      <p className="text-muted-foreground text-xs">
        Showing the latest 100 events.
      </p>
    </section>
  );
}
