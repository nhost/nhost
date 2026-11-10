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

  return (
    <RouteTabs aria-label="GraphQL section navigation">
      <RouteTabLink href={`${projectPath}/graphql`} exact>
        Playground
      </RouteTabLink>
      <RouteTabLink href={`${projectPath}/graphql/remote-schemas`}>
        Remote Schemas
      </RouteTabLink>
      <RouteTabLink href={`${projectPath}/graphql/actions`}>
        Actions
      </RouteTabLink>
      <RouteTabLink href={`${projectPath}/graphql/metadata`} exact>
        Metadata
      </RouteTabLink>
      <RouteTabLink href={`${projectPath}/graphql/console`} exact>
        Console
      </RouteTabLink>
      <RouteTabSeparator />
      <RouteTabLink
        href={`${projectPath}/graphql/settings`}
        exact
        disabled={shouldDisableSettings}
      >
        Settings
      </RouteTabLink>
    </RouteTabs>
  );
}
