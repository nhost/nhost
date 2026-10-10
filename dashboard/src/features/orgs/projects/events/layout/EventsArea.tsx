import type { PropsWithChildren } from 'react';
import { AreaLayout } from '@/features/orgs/projects/common/layout/AreaLayout';
import EventsRouteTabs from '@/features/orgs/projects/events/layout/EventsRouteTabs';

/**
 * Route tabs above the project-state gate. Whatever the page hands over is
 * rendered as-is below the tabs.
 */
export default function EventsArea({ children }: PropsWithChildren) {
  return <AreaLayout tabs={<EventsRouteTabs />}>{children}</AreaLayout>;
}
