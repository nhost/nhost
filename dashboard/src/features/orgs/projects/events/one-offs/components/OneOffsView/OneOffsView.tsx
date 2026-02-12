import { useState } from 'react';
import { PaginationControls } from '@/features/orgs/projects/events/common/components/PaginationControls';
import { useEventPagination } from '@/features/orgs/projects/events/common/hooks/useEventPagination';
import { useGetScheduledEventLogsQuery } from '@/features/orgs/projects/events/common/hooks/useGetScheduledEventLogsQuery';
import type { EventsSection } from '@/features/orgs/projects/events/common/types';
import { CreateOneOffForm } from '@/features/orgs/projects/events/one-offs/components/CreateOneOffForm';
import { OneOffEventsDataTable } from '@/features/orgs/projects/events/one-offs/components/OneOffEventsDataTable';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function OneOffsView() {
  const { project } = useProject();
  const isGitHubConnected = !!project?.githubRepository;
  const [eventLogsSection, setEventLogsSection] =
    useState<EventsSection>('all');

  const {
    offset,
    limit,
    setLimitAndReset,
    goPrev,
    goNext,
    hasNoPreviousPage,
    hasNoNextPage,
    data: eventsData,
    isLoading: isEventsLoading,
  } = useEventPagination({
    initialLimit: 10,
    useQueryHook: useGetScheduledEventLogsQuery,
    getQueryArgs: (limitArg, offsetArg) => ({
      type: 'one_off' as const,
      eventLogsSection,
      limit: limitArg,
      offset: offsetArg,
    }),
  });

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <div className="sticky top-0 z-10 border-b-1 bg-background">
        <div className="flex flex-col items-start justify-between gap-4 px-6 py-4 lg:flex-row lg:items-center">
          <h1 className="w-full">One-Off Scheduled Events</h1>

          <div className="flex w-full flex-row items-center gap-4">
            <PaginationControls
              className="px-0 py-0"
              offset={offset}
              limit={limit}
              hasNoPreviousPage={hasNoPreviousPage}
              hasNoNextPage={hasNoNextPage}
              onPrev={goPrev}
              onNext={() => !hasNoNextPage && goNext()}
              onChangeLimit={setLimitAndReset}
            />
            <CreateOneOffForm disabled={isGitHubConnected} />
          </div>
        </div>
      </div>
      <OneOffEventsDataTable
        eventLogsSection={eventLogsSection}
        onEventLogsSectionChange={setEventLogsSection}
        data={eventsData}
        isLoading={isEventsLoading}
        limit={limit}
      />
    </div>
  );
}
