import { useRouter } from 'next/router';
import { vi } from 'vitest';
import EventsRouteTabs from '@/features/orgs/projects/events/layout/EventsRouteTabs';
import { mockRouter } from '@/tests/mocks';
import { render, screen } from '@/tests/testUtils';

vi.mock('next/router', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/components/common/useMediaQuery', () => ({
  useMediaQuery: () => true,
}));

const PROJECT_PATH = '/orgs/nhost/projects/dashboard';
const EVENTS_ROUTE = '/orgs/[orgSlug]/projects/[appSubdomain]/events';

function setRoute(route: string, path: string) {
  vi.mocked(useRouter).mockReturnValue({
    ...mockRouter,
    route: `${EVENTS_ROUTE}/${route}`,
    pathname: `${EVENTS_ROUTE}/${route}`,
    asPath: `${PROJECT_PATH}/events/${path}`,
    query: { orgSlug: 'nhost', appSubdomain: 'dashboard' },
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('EventsRouteTabs', () => {
  it.each([
    ['Event Triggers', 'event-triggers', 'event-triggers', 'event-triggers'],
    [
      'Event Triggers',
      'event-triggers',
      'event-triggers/[eventTriggerSlug]',
      'event-triggers/user_created',
    ],
    ['Cron Jobs', 'cron-jobs', 'cron-jobs', 'cron-jobs'],
    [
      'Cron Jobs',
      'cron-jobs',
      'cron-jobs/webhook/[cronTriggerSlug]',
      'cron-jobs/webhook/nightly',
    ],
    ['Cron Jobs', 'cron-jobs', 'cron-jobs/sql/[jobId]', 'cron-jobs/sql/123'],
    ['Cron Jobs', 'cron-jobs', 'cron-jobs/settings', 'cron-jobs/settings'],
    ['One-Off Scheduled Events', 'one-offs', 'one-offs', 'one-offs'],
  ])('marks only %s current on %s', (name, slug, route, path) => {
    setRoute(route, path);
    render(<EventsRouteTabs />);

    const tab = screen.getByRole('link', { name });
    expect(tab).toHaveAttribute('href', `${PROJECT_PATH}/events/${slug}`);
    expect(screen.getAllByRole('link', { current: 'page' })).toEqual([tab]);
  });
});
