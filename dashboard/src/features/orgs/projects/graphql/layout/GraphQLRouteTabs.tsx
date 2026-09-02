import { useRouter } from 'next/router';
import {
  RouteTabLink,
  RouteTabSeparator,
  RouteTabs,
} from '@/components/ui/v3/route-tabs';
import { useSettingsDisabled } from '@/hooks/useSettingsDisabled';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

export default function GraphQLRouteTabs() {
  const router = useRouter();
  const shouldDisableSettings = useSettingsDisabled();
  const orgSlug = getSingleQueryParam(router.query.orgSlug);
  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);

  if (!orgSlug || !appSubdomain) {
    return null;
  }

  const projectPath = `/orgs/${orgSlug}/projects/${appSubdomain}`;
  const isPlaygroundActive =
    router.route === '/orgs/[orgSlug]/projects/[appSubdomain]/graphql';
  const isRemoteSchemasActive = router.route.startsWith(
    '/orgs/[orgSlug]/projects/[appSubdomain]/graphql/remote-schemas',
  );
  const isActionsActive = router.route.startsWith(
    '/orgs/[orgSlug]/projects/[appSubdomain]/graphql/actions',
  );
  const isMetadataActive = router.route.startsWith(
    '/orgs/[orgSlug]/projects/[appSubdomain]/graphql/metadata',
  );
  const isSettingsActive =
    router.route === '/orgs/[orgSlug]/projects/[appSubdomain]/graphql/settings';

  return (
    <RouteTabs aria-label="GraphQL section navigation">
      <RouteTabLink href={`${projectPath}/graphql`} active={isPlaygroundActive}>
        Playground
      </RouteTabLink>
      <RouteTabLink
        href={`${projectPath}/graphql/remote-schemas`}
        active={isRemoteSchemasActive}
      >
        Remote Schemas
      </RouteTabLink>
      <RouteTabLink
        href={`${projectPath}/graphql/actions`}
        active={isActionsActive}
      >
        Actions
      </RouteTabLink>
      <RouteTabLink
        href={`${projectPath}/graphql/metadata`}
        active={isMetadataActive}
      >
        Metadata
      </RouteTabLink>
      <RouteTabSeparator />
      <RouteTabLink
        href={`${projectPath}/graphql/settings`}
        active={isSettingsActive}
        disabled={shouldDisableSettings}
      >
        Settings
      </RouteTabLink>
    </RouteTabs>
  );
}
