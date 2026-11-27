import { useRouter } from 'next/router';
import { ProTag } from '@/components/common/ProTag';
import {
  AreaSidebarGroup,
  AreaSidebarLink,
  AreaSidebarNav,
  AreaSidebarRoot,
} from '@/components/layout/AreaSidebar';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

export default function DatabaseSettingsNavigation() {
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const orgSlug = getSingleQueryParam(router.query.orgSlug);
  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);

  if (!orgSlug || !appSubdomain) {
    return null;
  }

  const settingsPath = `/orgs/${orgSlug}/projects/${appSubdomain}/database/settings`;

  return (
    <AreaSidebarRoot data-wide-sidebar className="md:w-72">
      <AreaSidebarNav ariaLabel="Database settings navigation">
        <AreaSidebarGroup label="Engine">
          <AreaSidebarLink href={`${settingsPath}?tab=version`} exact shallow>
            Postgres version
          </AreaSidebarLink>
        </AreaSidebarGroup>
        <AreaSidebarGroup label="Storage">
          <AreaSidebarLink href={`${settingsPath}?tab=capacity`} exact shallow>
            <span>Capacity</span>
            <ProTag />
          </AreaSidebarLink>
          {isPlatform && (
            <AreaSidebarLink
              href={`${settingsPath}?tab=point-in-time`}
              exact
              shallow
            >
              <span>Point-in-Time Recovery</span>
              <ProTag />
            </AreaSidebarLink>
          )}
        </AreaSidebarGroup>
        {isPlatform && (
          <>
            <AreaSidebarGroup label="Connectivity">
              <AreaSidebarLink
                href={`${settingsPath}?tab=access`}
                exact
                shallow
              >
                Access
              </AreaSidebarLink>
              <AreaSidebarLink
                href={`${settingsPath}?tab=custom-domain`}
                exact
                shallow
              >
                <span>Custom Domain</span>
                <ProTag />
              </AreaSidebarLink>
            </AreaSidebarGroup>
            <AreaSidebarGroup label="Security">
              <AreaSidebarLink
                href={`${settingsPath}?tab=reset-password`}
                exact
                shallow
              >
                Reset password
              </AreaSidebarLink>
            </AreaSidebarGroup>
          </>
        )}
      </AreaSidebarNav>
    </AreaSidebarRoot>
  );
}
