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

  return (
    <RouteTabs aria-label="Events section navigation">
      <RouteTabLink href={`${projectPath}/events/event-triggers`}>
        Event Triggers
      </RouteTabLink>
      <RouteTabLink href={`${projectPath}/events/cron-triggers`}>
        Cron Triggers
      </RouteTabLink>
      <RouteTabLink href={`${projectPath}/events/one-offs`}>
        One-Off Scheduled Events
      </RouteTabLink>
    </RouteTabs>
  );
}
