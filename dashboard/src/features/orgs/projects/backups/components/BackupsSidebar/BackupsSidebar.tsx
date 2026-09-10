import { CloudIcon } from 'lucide-react';
import { useRouter } from 'next/router';
import { ProTag } from '@/components/common/ProTag';
import { FeatureSidebar } from '@/components/layout/FeatureSidebar';
import {
  SectionSidebarGroup,
  SectionSidebarLink,
  SectionSidebarNav,
} from '@/components/layout/SectionSidebar';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

export default function BackupsSidebar() {
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const { org } = useCurrentOrg();
  const isFreeOrg = isPlatform && org?.plan?.isFree;
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
    <FeatureSidebar
      className="w-[240px] max-w-[240px] border-r-0 md:pt-14"
      mobileBreakpoint="md"
      toggleIcon={<CloudIcon className="h-4 w-4 text-white" />}
      toggleOffset="left-8"
    >
      <SectionSidebarNav ariaLabel="Backups navigation">
        <SectionSidebarGroup label="Backups">
          <SectionSidebarLink
            href={backupsPath}
            active={isScheduledBackupsActive}
          >
            Scheduled backups
            {isFreeOrg && <ProTag />}
          </SectionSidebarLink>
          <SectionSidebarLink
            href={`${backupsPath}/point-in-time`}
            active={isPointInTimeActive}
          >
            Point-in-Time
            {isFreeOrg && <ProTag />}
          </SectionSidebarLink>
        </SectionSidebarGroup>
        <SectionSidebarGroup label="Transfer">
          <SectionSidebarLink
            href={`${backupsPath}/import`}
            active={isImportBackupActive}
          >
            Import backup
            {isFreeOrg && <ProTag />}
          </SectionSidebarLink>
        </SectionSidebarGroup>
      </SectionSidebarNav>
    </FeatureSidebar>
  );
}
