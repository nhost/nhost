import { useRouter } from 'next/router';
import { type ReactElement, useEffect } from 'react';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { AppLayout } from '@/components/layout/AppLayout';
import { Spinner } from '@/components/ui/v3/spinner';
import { ProjectScope } from '@/features/orgs/layout/ProjectScope';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { CustomDomainsNotice } from '@/features/orgs/projects/custom-domains/settings/components/CustomDomainsNotice';
import { DatabaseDomain } from '@/features/orgs/projects/custom-domains/settings/components/DatabaseDomain';
import { DatabaseArea } from '@/features/orgs/projects/database/layout';
import { DatabaseAllowedCIDRs } from '@/features/orgs/projects/database/settings/components/DatabaseAllowedCIDRs';
import { DatabaseConnectionInfo } from '@/features/orgs/projects/database/settings/components/DatabaseConnectionInfo';
import { DatabasePiTRSettings } from '@/features/orgs/projects/database/settings/components/DatabasePiTRSettings';
import { DatabaseServiceVersionSettings } from '@/features/orgs/projects/database/settings/components/DatabaseServiceVersionSettings';
import { DatabaseSettingsNavigation } from '@/features/orgs/projects/database/settings/components/DatabaseSettingsNavigation';
import { DatabaseStorageCapacity } from '@/features/orgs/projects/database/settings/components/DatabaseStorageCapacity';
import { ResetDatabasePasswordSettings } from '@/features/orgs/projects/database/settings/components/ResetDatabasePasswordSettings';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useGetPostgresSettingsQuery } from '@/generated/graphql';

function DatabaseCustomDomainSettings() {
  const { org } = useCurrentOrg();

  if (org?.plan?.isFree) {
    return (
      <UpgradeToProBanner
        section="settings-custom-domains"
        title="To unlock Custom Domains, transfer this project to a Pro or Team organization."
        description=""
      />
    );
  }

  return (
    <div className="grid grid-flow-row gap-6">
      <CustomDomainsNotice />
      <DatabaseDomain />
    </div>
  );
}

export default function DatabaseSettingsPage() {
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { project, loading: loadingProject } = useProject();
  const tab = router.query.tab;
  const isValidTab =
    typeof tab === 'string' &&
    (tab === 'version' ||
      tab === 'capacity' ||
      (isPlatform &&
        ['point-in-time', 'access', 'custom-domain', 'reset-password'].includes(
          tab,
        )));

  useEffect(() => {
    if (!router.isReady || isValidTab) {
      return;
    }

    void router.replace(
      { pathname: router.pathname, query: { ...router.query, tab: 'version' } },
      undefined,
      { shallow: true },
    );
  }, [isValidTab, router]);

  const { data, error } = useGetPostgresSettingsQuery({
    variables: { appId: project?.id },
    skip: !project?.id || !isValidTab,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (error) {
    throw error;
  }

  const isInitialLoading = loadingProject || !project?.id || !data;

  if (!isValidTab || isInitialLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  let content = <DatabaseServiceVersionSettings />;

  if (tab === 'capacity') {
    content = <DatabaseStorageCapacity />;
  }

  if (isPlatform) {
    switch (tab) {
      case 'point-in-time':
        content = <DatabasePiTRSettings />;
        break;
      case 'access':
        content = (
          <div className="grid grid-flow-row gap-y-6">
            <DatabaseConnectionInfo />
            <DatabaseAllowedCIDRs />
          </div>
        );
        break;
      case 'custom-domain':
        content = <DatabaseCustomDomainSettings />;
        break;
      case 'reset-password':
        content = <ResetDatabasePasswordSettings />;
        break;
      default:
        break;
    }
  }

  return content;
}

DatabaseSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <DatabaseArea>
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col md:flex-row">
            <DatabaseSettingsNavigation />
            <div className="min-w-0 flex-1">
              <SettingsLayout>{page}</SettingsLayout>
            </div>
          </div>
        </DatabaseArea>
      </ProjectScope>
    </AppLayout>
  );
};
