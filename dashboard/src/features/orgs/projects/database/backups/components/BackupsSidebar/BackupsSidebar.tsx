import { useRouter } from 'next/router';
import {
  AreaSidebarGroup,
  AreaSidebarLink,
  AreaSidebarNav,
  AreaSidebarRoot,
} from '@/components/layout/AreaSidebar';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

export default function BackupsSidebar() {
  const router = useRouter();
  const orgSlug = getSingleQueryParam(router.query.orgSlug);
  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);

  if (!orgSlug || !appSubdomain) {
    return null;
  }

  const backupsPath = `/orgs/${orgSlug}/projects/${appSubdomain}/database/backups`;

  return (
    <AreaSidebarRoot>
      <AreaSidebarNav ariaLabel="Backups navigation">
        <AreaSidebarGroup label="Backups">
          <AreaSidebarLink href={backupsPath} exact>
            Scheduled backups
          </AreaSidebarLink>
          <AreaSidebarLink href={`${backupsPath}/point-in-time`}>
            Point-in-Time
          </AreaSidebarLink>
        </AreaSidebarGroup>
        <AreaSidebarGroup label="Transfer">
          <AreaSidebarLink href={`${backupsPath}/import`}>
            Import backup
          </AreaSidebarLink>
        </AreaSidebarGroup>
      </AreaSidebarNav>
    </AreaSidebarRoot>
  );
}
