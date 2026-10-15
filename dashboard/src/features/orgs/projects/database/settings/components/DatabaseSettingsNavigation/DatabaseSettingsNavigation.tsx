import {
  AreaSidebarGroup,
  AreaSidebarLink,
  AreaSidebarNav,
  AreaSidebarRoot,
} from '@/components/layout/AreaSidebar';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';

export default function DatabaseSettingsNavigation() {
  const isPlatform = useIsPlatform();

  return (
    <AreaSidebarRoot>
      <AreaSidebarNav ariaLabel="Database settings navigation">
        <AreaSidebarGroup label="Engine">
          <AreaSidebarLink
            from="/orgs/$orgSlug/projects/$appSubdomain"
            to="/orgs/$orgSlug/projects/$appSubdomain/database/settings"
            params
            search={{ tab: 'version' }}
            exact
          >
            Postgres version
          </AreaSidebarLink>
        </AreaSidebarGroup>
        <AreaSidebarGroup label="Storage">
          <AreaSidebarLink
            from="/orgs/$orgSlug/projects/$appSubdomain"
            to="/orgs/$orgSlug/projects/$appSubdomain/database/settings"
            params
            search={{ tab: 'capacity' }}
            exact
          >
            Capacity
          </AreaSidebarLink>
          {isPlatform && (
            <AreaSidebarLink
              from="/orgs/$orgSlug/projects/$appSubdomain"
              to="/orgs/$orgSlug/projects/$appSubdomain/database/settings"
              params
              search={{ tab: 'point-in-time' }}
              exact
            >
              Point-in-Time Recovery
            </AreaSidebarLink>
          )}
        </AreaSidebarGroup>
        {isPlatform && (
          <>
            <AreaSidebarGroup label="Connectivity">
              <AreaSidebarLink
                from="/orgs/$orgSlug/projects/$appSubdomain"
                to="/orgs/$orgSlug/projects/$appSubdomain/database/settings"
                params
                search={{ tab: 'access' }}
                exact
              >
                Access
              </AreaSidebarLink>
              <AreaSidebarLink
                from="/orgs/$orgSlug/projects/$appSubdomain"
                to="/orgs/$orgSlug/projects/$appSubdomain/database/settings"
                params
                search={{ tab: 'custom-domain' }}
                exact
              >
                Custom Domain
              </AreaSidebarLink>
            </AreaSidebarGroup>
            <AreaSidebarGroup label="Security">
              <AreaSidebarLink
                from="/orgs/$orgSlug/projects/$appSubdomain"
                to="/orgs/$orgSlug/projects/$appSubdomain/database/settings"
                params
                search={{ tab: 'reset-password' }}
                exact
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
