import type { PropsWithChildren } from 'react';
import { ProjectViewWithState } from '@/features/orgs/layout/ProjectGuard';
import EventsRouteTabs from '@/features/orgs/projects/events/layout/EventsRouteTabs';

/**
 * Route tabs above the project-state gate. Whatever the page hands over is
 * rendered as-is below the tabs.
 */
export default function EventsArea({ children }: PropsWithChildren) {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pt-3 pb-4">
        <EventsRouteTabs />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <ProjectViewWithState>{children}</ProjectViewWithState>
      </div>
    </div>
  );
}
