import { useRouter } from 'next/router';
import {
  RouteTabLink,
  RouteTabSeparator,
  RouteTabs,
} from '@/components/ui/v3/route-tabs';
import { useSettingsDisabled } from '@/hooks/useSettingsDisabled';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

export default function FunctionsRouteTabs() {
  const router = useRouter();
  const shouldDisableSettings = useSettingsDisabled();
  const orgSlug = getSingleQueryParam(router.query.orgSlug);
  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);

  if (!orgSlug || !appSubdomain) {
    return null;
  }

  const projectPath = `/orgs/${orgSlug}/projects/${appSubdomain}`;

  return (
    <RouteTabs aria-label="Functions section navigation">
      <RouteTabLink href={`${projectPath}/functions/browser`}>
        Functions
      </RouteTabLink>
      <RouteTabSeparator />
      <RouteTabLink
        href={`${projectPath}/functions/settings`}
        exact
        disabled={shouldDisableSettings}
      >
        Settings
      </RouteTabLink>
    </RouteTabs>
  );
}
