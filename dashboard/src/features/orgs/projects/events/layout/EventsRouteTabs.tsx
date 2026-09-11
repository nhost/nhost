import { useRouter } from 'next/router';
import { RouteTabLink, RouteTabs } from '@/components/ui/v3/route-tabs';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

export default function EventsRouteTabs() {
  const router = useRouter();
  const orgSlug = getSingleQueryParam(router.query.orgSlug);
  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);

  if (!orgSlug || !appSubdomain) {
    return null;
  }

  const projectPath = `/orgs/${orgSlug}/projects/${appSubdomain}`;
  const eventsRoute = '/orgs/[orgSlug]/projects/[appSubdomain]/events';
  const isEventTriggersActive = router.route.startsWith(
    `${eventsRoute}/event-triggers`,
  );
  const isCronTriggersActive = router.route.startsWith(
    `${eventsRoute}/cron-triggers`,
  );
  const isOneOffsActive = router.route.startsWith(`${eventsRoute}/one-offs`);

  return (
    <RouteTabs aria-label="Events section navigation">
      <RouteTabLink
        href={`${projectPath}/events/event-triggers`}
        active={isEventTriggersActive}
      >
        Event Triggers
      </RouteTabLink>
      <RouteTabLink
        href={`${projectPath}/events/cron-triggers`}
        active={isCronTriggersActive}
      >
        Cron Triggers
      </RouteTabLink>
      <RouteTabLink
        href={`${projectPath}/events/one-offs`}
        active={isOneOffsActive}
      >
        One-Off Scheduled Events
      </RouteTabLink>
    </RouteTabs>
  );
}
