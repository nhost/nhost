import { useRouter } from 'next/router';
import {
  RouteTabLink,
  RouteTabSeparator,
  RouteTabs,
} from '@/components/ui/v3/route-tabs';
import { useSettingsDisabled } from '@/hooks/useSettingsDisabled';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

export default function AuthRouteTabs() {
  const router = useRouter();
  const shouldDisableSettings = useSettingsDisabled();
  const orgSlug = getSingleQueryParam(router.query.orgSlug);
  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);

  if (!orgSlug || !appSubdomain) {
    return null;
  }

  const projectPath = `/orgs/${orgSlug}/projects/${appSubdomain}`;
  const isUsersActive =
    router.route === '/orgs/[orgSlug]/projects/[appSubdomain]/auth/users';
  const isOAuth2ClientsActive =
    router.route ===
    '/orgs/[orgSlug]/projects/[appSubdomain]/auth/oauth2-clients';
  const isSettingsActive =
    router.route === '/orgs/[orgSlug]/projects/[appSubdomain]/auth/settings';

  return (
    <RouteTabs aria-label="Auth section navigation">
      <RouteTabLink href={`${projectPath}/auth/users`} active={isUsersActive}>
        Users
      </RouteTabLink>
      <RouteTabLink
        href={`${projectPath}/auth/oauth2-clients`}
        active={isOAuth2ClientsActive}
      >
        OAuth2 Clients
      </RouteTabLink>
      <RouteTabSeparator />
      <RouteTabLink
        href={`${projectPath}/auth/settings`}
        active={isSettingsActive}
        disabled={shouldDisableSettings}
      >
        Settings
      </RouteTabLink>
    </RouteTabs>
  );
}
