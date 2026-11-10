import type { ReactElement } from 'react';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { AppLayout } from '@/components/layout/AppLayout';
import { Spinner } from '@/components/ui/v3/spinner';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import {
  type SettingsTab,
  SettingsTabs,
} from '@/features/orgs/projects/common/components/settings/SettingsTabs';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { AreaSettingsLayout } from '@/features/orgs/projects/common/layout/AreaSettingsLayout';
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

function DatabaseAccessSettings() {
  return (
    <div className="grid grid-flow-row gap-y-6">
      <DatabaseConnectionInfo />
      <DatabaseAllowedCIDRs />
    </div>
  );
}

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

const DATABASE_SETTINGS_TABS = {
  version: {
    title: 'Postgres version',
    Component: DatabaseServiceVersionSettings,
  },
  capacity: { title: 'Capacity', Component: DatabaseStorageCapacity },
} satisfies Record<string, SettingsTab>;

/** The same as the sidebar, which only links these tabs on the platform. */
const PLATFORM_DATABASE_SETTINGS_TABS = {
  ...DATABASE_SETTINGS_TABS,
  'point-in-time': {
    title: 'Point-in-Time Recovery',
    Component: DatabasePiTRSettings,
  },
  access: { title: 'Access', Component: DatabaseAccessSettings },
  'custom-domain': {
    title: 'Custom Domain',
    Component: DatabaseCustomDomainSettings,
  },
  'reset-password': {
    title: 'Reset password',
    Component: ResetDatabasePasswordSettings,
  },
} satisfies Record<string, SettingsTab>;

export default function DatabaseSettingsPage() {
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { project, loading: loadingProject } = useProject();

  const { data, error } = useGetPostgresSettingsQuery({
    variables: { appId: project?.id },
    skip: !project?.id,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (error) {
    throw error;
  }

  const isInitialLoading = loadingProject || !project?.id || !data;

  if (isInitialLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <SettingsTabs
      tabs={
        isPlatform ? PLATFORM_DATABASE_SETTINGS_TABS : DATABASE_SETTINGS_TABS
      }
      defaultTab="version"
    />
  );
}

DatabaseSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <DatabaseArea>
          <AreaSettingsLayout sidebar={<DatabaseSettingsNavigation />}>
            {page}
          </AreaSettingsLayout>
        </DatabaseArea>
      </ProjectScope>
    </AppLayout>
  );
};
