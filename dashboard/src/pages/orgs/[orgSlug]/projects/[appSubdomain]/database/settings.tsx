import { SettingsIcon } from 'lucide-react';
import { useRouter } from 'next/router';
import type { ReactElement, ReactNode } from 'react';
import { ProTag } from '@/components/common/ProTag';
import { UpgradeBanner } from '@/components/common/UpgradeBanner';
import { dashboardNavItemTextClassName } from '@/components/layout/DashboardSidebar/DashboardSidebar';
import { FeatureSidebar } from '@/components/layout/FeatureSidebar';
import { Spinner } from '@/components/ui/v3/spinner';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v3/tabs';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { DatabaseDomain } from '@/features/orgs/projects/custom-domains/settings/components/DatabaseDomain';
import { getDatabaseLayout } from '@/features/orgs/projects/database/layout';
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
import { cn } from '@/lib/utils';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

type DatabaseSettingsTab =
  | 'version'
  | 'capacity'
  | 'point-in-time'
  | 'public-access'
  | 'custom-domain'
  | 'reset-password';

const DATABASE_SETTINGS_DEFAULT_TAB: DatabaseSettingsTab = 'version';

function isDatabaseSettingsTab(
  value: string | undefined,
): value is DatabaseSettingsTab {
  return (
    value === 'version' ||
    value === 'capacity' ||
    value === 'point-in-time' ||
    value === 'public-access' ||
    value === 'custom-domain' ||
    value === 'reset-password'
  );
}

function isPlatformOnlyDatabaseSettingsTab(tab: DatabaseSettingsTab) {
  return (
    tab === 'point-in-time' ||
    tab === 'public-access' ||
    tab === 'custom-domain' ||
    tab === 'reset-password'
  );
}

function getDatabaseSettingsTab(
  value: string | string[] | undefined,
  isPlatform: boolean,
): DatabaseSettingsTab {
  const tab = getSingleQueryParam(value);

  if (!isDatabaseSettingsTab(tab)) {
    return DATABASE_SETTINGS_DEFAULT_TAB;
  }

  if (!isPlatform && isPlatformOnlyDatabaseSettingsTab(tab)) {
    return DATABASE_SETTINGS_DEFAULT_TAB;
  }

  return tab;
}

interface DatabaseSettingsSectionLabelProps {
  children: ReactNode;
}

/** Uppercase group label above a set of related settings tabs, matching the
 * section label style used in the main project sidebar. */
const databaseSettingsTabTriggerClassName = cn(
  'flex w-full items-center justify-start gap-2.5 rounded-md px-2 py-1.5 text-left',
  dashboardNavItemTextClassName,
  'data-[state=active]:bg-neutral-100 data-[state=active]:text-primary data-[state=active]:hover:bg-neutral-100 data-[state=active]:hover:text-primary dark:data-[state=active]:bg-muted dark:data-[state=active]:text-primary dark:data-[state=active]:hover:bg-muted dark:data-[state=active]:hover:text-primary',
);

function DatabaseSettingsSectionLabel({
  children,
}: DatabaseSettingsSectionLabelProps) {
  return (
    <p className="mt-6 px-2 pb-1 text-[10px] font-normal uppercase tracking-[0.08em] text-muted-foreground first:mt-0 dark:text-sidebar-section-title">
      {children}
    </p>
  );
}

function DatabaseSettingsSidebar() {
  const isPlatform = useIsPlatform();
  const { org } = useCurrentOrg();
  const isFreeOrg = isPlatform && org?.plan?.isFree;

  return (
    <FeatureSidebar
      className="w-[240px] max-w-[240px] border-r-0 md:pt-14"
      mobileBreakpoint="md"
      toggleIcon={<SettingsIcon className="h-4 w-4 text-white" />}
      toggleOffset="left-8"
    >
      <TabsList
        aria-label="Database settings navigation"
        className="flex h-full min-h-0 w-full flex-col items-stretch justify-start rounded-none bg-transparent p-2 text-muted-foreground"
      >
        <DatabaseSettingsSectionLabel>Engine</DatabaseSettingsSectionLabel>
        <TabsTrigger value="version" className={databaseSettingsTabTriggerClassName}>
          Postgres version
        </TabsTrigger>

        <DatabaseSettingsSectionLabel>Storage</DatabaseSettingsSectionLabel>
        <TabsTrigger value="capacity" className={databaseSettingsTabTriggerClassName}>
          Capacity
          {isFreeOrg && <ProTag />}
        </TabsTrigger>
        {isPlatform && (
          <TabsTrigger
            value="point-in-time"
            className={databaseSettingsTabTriggerClassName}
          >
            Point-in-Time Recovery
            {isFreeOrg && <ProTag />}
          </TabsTrigger>
        )}

        {isPlatform && (
          <>
            <DatabaseSettingsSectionLabel>Connectivity</DatabaseSettingsSectionLabel>
            <TabsTrigger
              value="public-access"
              className={databaseSettingsTabTriggerClassName}
            >
              Access
            </TabsTrigger>
            <TabsTrigger
              value="custom-domain"
              className={databaseSettingsTabTriggerClassName}
            >
              Custom Domain
              {isFreeOrg && <ProTag />}
            </TabsTrigger>

            <DatabaseSettingsSectionLabel>Security</DatabaseSettingsSectionLabel>
            <TabsTrigger
              value="reset-password"
              className={databaseSettingsTabTriggerClassName}
            >
              Reset password
            </TabsTrigger>
          </>
        )}
      </TabsList>
    </FeatureSidebar>
  );
}

interface DatabaseSettingsTabsProps {
  children: ReactNode;
}

/**
 * Shares a single vertical `Tabs` context across the settings sub-sidebar (the
 * `TabsList`) and the content panels (`TabsContent`). Rendered with `contents`
 * so it adds no layout box, and mounted as a `wrapper` inside `ProjectLayout`
 * rather than around it, so the project shell persists across navigation.
 */
function DatabaseSettingsTabs({ children }: DatabaseSettingsTabsProps) {
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const activeTab = getDatabaseSettingsTab(router.query.tab, isPlatform);

  function handleTabChange(nextTab: string) {
    if (!isDatabaseSettingsTab(nextTab)) {
      return;
    }

    if (!isPlatform && isPlatformOnlyDatabaseSettingsTab(nextTab)) {
      return;
    }

    const nextQuery = { ...router.query };

    if (nextTab === DATABASE_SETTINGS_DEFAULT_TAB) {
      delete nextQuery.tab;
    } else {
      nextQuery.tab = nextTab;
    }

    void router.replace(
      {
        pathname: router.pathname,
        query: nextQuery,
      },
      undefined,
      { shallow: true, scroll: false },
    );
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      orientation="vertical"
      className="contents"
    >
      {children}
    </Tabs>
  );
}

function DatabaseCustomDomainSettings() {
  const { org } = useCurrentOrg();

  if (org?.plan?.isFree) {
    return (
      <UpgradeBanner section="settings-custom-domains" />
    );
  }

  return <DatabaseDomain />;
}

function DatabaseCapacitySettings() {
  const { org } = useCurrentOrg();

  if (org?.plan?.isFree) {
    return <UpgradeBanner section="settings-capacity" />;
  }

  return <DatabaseStorageCapacity />;
}

function DatabasePointInTimeRecoverySettings() {
  const { org } = useCurrentOrg();

  if (org?.plan?.isFree) {
    return <UpgradeBanner section="settings-point-in-time" />;
  }

  return <DatabasePiTRSettings />;
}

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
      <div className="flex flex-auto items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <SettingsLayout>
      <div className="w-full px-5 pb-4">
        <div className="grid grid-flow-row gap-y-6">
          <TabsContent value="version" className="mt-0">
            <DatabaseServiceVersionSettings />
          </TabsContent>

          <TabsContent value="capacity" className="mt-0">
            <DatabaseCapacitySettings />
          </TabsContent>

          {isPlatform && (
            <>
              <TabsContent value="point-in-time" className="mt-0">
                <DatabasePointInTimeRecoverySettings />
              </TabsContent>

              <TabsContent
                value="public-access"
                className="mt-0 grid grid-flow-row gap-y-6"
              >
                <DatabaseConnectionInfo />
                <DatabaseAllowedCIDRs />
              </TabsContent>

              <TabsContent value="custom-domain" className="mt-0">
                <DatabaseCustomDomainSettings />
              </TabsContent>

              <TabsContent value="reset-password" className="mt-0">
                <ResetDatabasePasswordSettings />
              </TabsContent>
            </>
          )}
        </div>
      </div>
    </SettingsLayout>
  );
}

DatabaseSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return getDatabaseLayout(page, {
    sidebar: <DatabaseSettingsSidebar />,
    bodyClassName: 'self-center w-full max-w-[1000px]',
    contentClassName: 'flex flex-col',
    wrapper: (body) => <DatabaseSettingsTabs>{body}</DatabaseSettingsTabs>,
  });
};
