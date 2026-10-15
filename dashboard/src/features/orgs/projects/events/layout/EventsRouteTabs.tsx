import { RouteTabLink, RouteTabs } from '@/components/ui/v3/route-tabs';

export default function EventsRouteTabs() {
  return (
    <RouteTabs aria-label="Events section navigation">
      <RouteTabLink
        from="/orgs/$orgSlug/projects/$appSubdomain"
        to="/orgs/$orgSlug/projects/$appSubdomain/events/event-triggers"
        params
      >
        Event Triggers
      </RouteTabLink>
      <RouteTabLink
        from="/orgs/$orgSlug/projects/$appSubdomain"
        to="/orgs/$orgSlug/projects/$appSubdomain/events/cron-triggers"
        params
      >
        Cron Triggers
      </RouteTabLink>
      <RouteTabLink
        from="/orgs/$orgSlug/projects/$appSubdomain"
        to="/orgs/$orgSlug/projects/$appSubdomain/events/one-offs"
        params
      >
        One-Off Scheduled Events
      </RouteTabLink>
    </RouteTabs>
  );
}
