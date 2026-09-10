import type { ReactElement } from 'react';
import {
  getProjectLayout,
  type ProjectLayoutOptions,
} from '@/features/orgs/layout/ProjectLayout';
import EventsRouteTabs from '@/features/orgs/projects/events/layout/EventsRouteTabs';

export type GetEventsLayoutOptions = Omit<ProjectLayoutOptions, 'navigation'>;

export function getEventsLayout(
  page: ReactElement,
  options: GetEventsLayoutOptions = {},
): ReactElement {
  return getProjectLayout(page, {
    contentClassName: 'flex flex-col overflow-x-hidden overflow-y-hidden',
    ...options,
    navigation: <EventsRouteTabs />,
  });
}
