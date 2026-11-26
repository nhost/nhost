import { useRouter } from 'next/router';
import { ProTag } from '@/components/common/ProTag';
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
            <span>Scheduled backups</span>
            <ProTag />
          </AreaSidebarLink>
          <AreaSidebarLink href={`${backupsPath}/point-in-time`}>
            <span>Point-in-Time</span>
            <ProTag />
          </AreaSidebarLink>
        </AreaSidebarGroup>
        <AreaSidebarGroup label="Transfer">
          <AreaSidebarLink href={`${backupsPath}/import`}>
            <span>Import backup</span>
            <ProTag />
          </AreaSidebarLink>
        </AreaSidebarGroup>
      </AreaSidebarNav>
    </AreaSidebarRoot>
  );
}
