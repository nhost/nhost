import {
  AreaSidebarGroup,
  AreaSidebarLink,
  AreaSidebarNav,
  AreaSidebarRoot,
} from '@/components/layout/AreaSidebar';

export default function BackupsSidebar() {
  return (
    <AreaSidebarRoot>
      <AreaSidebarNav ariaLabel="Backups navigation">
        <AreaSidebarGroup label="Backups">
          <AreaSidebarLink
            from="/orgs/$orgSlug/projects/$appSubdomain"
            to="/orgs/$orgSlug/projects/$appSubdomain/database/backups"
            params
            exact
          >
            Scheduled backups
          </AreaSidebarLink>
          <AreaSidebarLink
            from="/orgs/$orgSlug/projects/$appSubdomain"
            to="/orgs/$orgSlug/projects/$appSubdomain/database/backups/point-in-time"
            params
          >
            Point-in-Time
          </AreaSidebarLink>
        </AreaSidebarGroup>
        <AreaSidebarGroup label="Transfer">
          <AreaSidebarLink
            from="/orgs/$orgSlug/projects/$appSubdomain"
            to="/orgs/$orgSlug/projects/$appSubdomain/database/backups/import"
            params
          >
            Import backup
          </AreaSidebarLink>
        </AreaSidebarGroup>
      </AreaSidebarNav>
    </AreaSidebarRoot>
  );
}
