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
  const isScheduledBackupsActive =
    router.route === '/orgs/[orgSlug]/projects/[appSubdomain]/database/backups';
  const isPointInTimeActive =
    router.route ===
    '/orgs/[orgSlug]/projects/[appSubdomain]/database/backups/point-in-time';
  const isImportBackupActive =
    router.route ===
    '/orgs/[orgSlug]/projects/[appSubdomain]/database/backups/import';

  return (
    <AreaSidebarRoot>
      <AreaSidebarNav ariaLabel="Backups navigation">
        <AreaSidebarGroup label="Backups">
          <AreaSidebarLink
            href={backupsPath}
            active={isScheduledBackupsActive}
          >
            Scheduled backups
          </AreaSidebarLink>
          <AreaSidebarLink
            href={`${backupsPath}/point-in-time`}
            active={isPointInTimeActive}
          >
            Point-in-Time
          </AreaSidebarLink>
        </AreaSidebarGroup>
        <AreaSidebarGroup label="Transfer">
          <AreaSidebarLink
            href={`${backupsPath}/import`}
            active={isImportBackupActive}
          >
            Import backup
          </AreaSidebarLink>
        </AreaSidebarGroup>
      </AreaSidebarNav>
    </AreaSidebarRoot>
  );
}
