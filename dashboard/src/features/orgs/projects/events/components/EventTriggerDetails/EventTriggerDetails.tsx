import { EventsEmptyState } from '@/features/orgs/projects/events/components/EventsEmptyState';
import { useGetEventTriggers } from '@/features/orgs/projects/events/hooks/useGetEventTriggers';
import { useRouter } from 'next/router';

export default function EventTriggerDetails() {
  const router = useRouter();

  const { eventTriggerSlug } = router.query;

  const { data: eventTriggers, status } = useGetEventTriggers();

  const eventTrigger = eventTriggers?.find(
    (trigger) => trigger.name === eventTriggerSlug,
  );

  if (status === 'loading' || !eventTrigger) {
    return (
      <EventsEmptyState
        title="Event trigger not found"
        description={
          <span>
            Event trigger{' '}
            <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold">
              {eventTriggerSlug}
            </code>{' '}
            does not exist.
          </span>
        }
      />
    );
  }

  return <div className="space-y-6 p-4">Event Trigger</div>;
}
