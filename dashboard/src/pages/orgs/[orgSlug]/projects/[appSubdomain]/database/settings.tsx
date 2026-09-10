import { useRouter } from 'next/router';
import type { ComponentType, ReactElement } from 'react';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  AreaSidebarGroup,
  AreaSidebarLink,
  AreaSidebarNav,
  AreaSidebarRoot,
} from '@/components/layout/AreaSidebar';
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
import { DatabaseStorageCapacity } from '@/features/orgs/projects/database/settings/components/DatabaseStorageCapacity';
import { ResetDatabasePasswordSettings } from '@/features/orgs/projects/database/settings/components/ResetDatabasePasswordSettings';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useGetPostgresSettingsQuery } from '@/generated/graphql';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

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

interface DatabaseSettingsTab {
  slug: string;
  label: string;
  Content: ComponentType;
  platformOnly?: boolean;
}

interface DatabaseSettingsGroup {
  label: string;
  tabs: readonly DatabaseSettingsTab[];
}

const DATABASE_SETTINGS_GROUPS: readonly DatabaseSettingsGroup[] = [
  {
    label: 'Engine',
    tabs: [
      {
        slug: 'version',
        label: 'Postgres version',
        Content: DatabaseServiceVersionSettings,
      },
    ],
  },
  {
    label: 'Storage',
    tabs: [
      { slug: 'capacity', label: 'Capacity', Content: DatabaseStorageCapacity },
      {
        slug: 'point-in-time',
        label: 'Point-in-Time Recovery',
        Content: DatabasePiTRSettings,
        platformOnly: true,
      },
    ],
  },
  {
    label: 'Connectivity',
    tabs: [
      {
        slug: 'access',
        label: 'Access',
        Content: DatabaseAccessSettings,
        platformOnly: true,
      },
      {
        slug: 'custom-domain',
        label: 'Custom Domain',
        Content: DatabaseCustomDomainSettings,
        platformOnly: true,
      },
    ],
  },
  {
    label: 'Security',
    tabs: [
      {
        slug: 'reset-password',
        label: 'Reset password',
        Content: ResetDatabasePasswordSettings,
        platformOnly: true,
      },
    ],
  },
];

const DEFAULT_TAB = DATABASE_SETTINGS_GROUPS[0].tabs[0];

/**
 * The active tab lives in `?tab=`; an unknown value, or a platform-only
 * one on self-hosted, falls back to the first tab.
 */
function useDatabaseSettingsTabs() {
  const router = useRouter();
  const isPlatform = useIsPlatform();

  const groups = DATABASE_SETTINGS_GROUPS.map((group) => ({
    ...group,
    tabs: group.tabs.filter(
      (tab) => isPlatform || !tab.platformOnly,
    ),
  })).filter((group) => group.tabs.length > 0);

  const requested = getSingleQueryParam(router.query.tab);
  const activeTab =
    groups
      .flatMap((group) => group.tabs)
      .find((tab) => tab.slug === requested) ?? DEFAULT_TAB;

  function hrefFor(tab: DatabaseSettingsTab) {
    const { tab: _tab, ...query } = router.query;

    return {
      pathname: router.pathname,
      query:
        tab.slug === DEFAULT_TAB.slug
          ? query
          : { ...query, tab: tab.slug },
    };
  }

  return { groups, activeTab, hrefFor };
}

function DatabaseSettingsSidebar() {
  const { groups, activeTab, hrefFor } = useDatabaseSettingsTabs();

  return (
    <AreaSidebarRoot>
      <AreaSidebarNav ariaLabel="Database settings navigation">
        {groups.map((group) => (
          <AreaSidebarGroup key={group.label} label={group.label}>
            {group.tabs.map((tab) => (
              <AreaSidebarLink
                key={tab.slug}
                href={hrefFor(tab)}
                active={tab.slug === activeTab.slug}
                shallow
                scroll={false}
              >
                {tab.label}
              </AreaSidebarLink>
            ))}
          </AreaSidebarGroup>
        ))}
      </AreaSidebarNav>
    </AreaSidebarRoot>
  );
}

export default function DatabaseSettingsPage() {
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { project, loading: loadingProject } = useProject();
  const { activeTab } = useDatabaseSettingsTabs();

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
    <SettingsLayout>
      <activeTab.Content />
    </SettingsLayout>
  );
}

DatabaseSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <DatabaseArea>
          <div className="mx-auto flex h-full w-full max-w-6xl">
            <DatabaseSettingsSidebar />
            <div className="min-w-0 flex-1">{page}</div>
          </div>
        </DatabaseArea>
      </ProjectScope>
    </AppLayout>
  );
};
