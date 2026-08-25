import { SettingsIcon } from 'lucide-react';
import { useRouter } from 'next/router';
import type { ReactElement, ReactNode } from 'react';
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
import { getDatabaseLayout } from '@/features/orgs/projects/database/layout';
import { DatabaseAllowedCIDRs } from '@/features/orgs/projects/database/settings/components/DatabaseAllowedCIDRs';
import { DatabaseConnectionInfo } from '@/features/orgs/projects/database/settings/components/DatabaseConnectionInfo';
import { DatabasePiTRSettings } from '@/features/orgs/projects/database/settings/components/DatabasePiTRSettings';
import { DatabaseServiceVersionSettings } from '@/features/orgs/projects/database/settings/components/DatabaseServiceVersionSettings';
import { DatabaseStorageCapacity } from '@/features/orgs/projects/database/settings/components/DatabaseStorageCapacity';
import { ResetDatabasePasswordSettings } from '@/features/orgs/projects/database/settings/components/ResetDatabasePasswordSettings';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useGetPostgresSettingsQuery } from '@/generated/graphql';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

type DatabaseSettingsTab =
  | 'version'
  | 'capacity'
  | 'point-in-time'
  | 'public-access'
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
    value === 'reset-password'
  );
}

function isPlatformOnlyDatabaseSettingsTab(tab: DatabaseSettingsTab) {
  return (
    tab === 'point-in-time' ||
    tab === 'public-access' ||
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

function DatabaseSettingsSidebar() {
  const isPlatform = useIsPlatform();

  return (
    <FeatureSidebar
      className="w-[280px] max-w-[280px] border-r-0 bg-background-default"
      mobileBreakpoint="md"
      toggleIcon={<SettingsIcon className="h-4 w-4 text-white" />}
      toggleOffset="left-8"
    >
      <TabsList
        aria-label="Database settings navigation"
        className="flex h-full min-h-0 w-full flex-col items-stretch justify-start gap-1 rounded-none bg-transparent px-4 py-6 text-muted-foreground"
      >
        <TabsTrigger
          value="version"
          className="h-10 w-full justify-start rounded-lg px-3 text-left font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground data-[state=active]:bg-muted data-[state=active]:text-primary data-[state=active]:shadow-none"
        >
          Postgres version
        </TabsTrigger>
        <TabsTrigger
          value="capacity"
          className="h-10 w-full justify-start rounded-lg px-3 text-left font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground data-[state=active]:bg-muted data-[state=active]:text-primary data-[state=active]:shadow-none"
        >
          Capacity
        </TabsTrigger>
        {isPlatform && (
          <>
            <TabsTrigger
              value="point-in-time"
              className="h-10 w-full justify-start rounded-lg px-3 text-left font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground data-[state=active]:bg-muted data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              Point-in-Time
            </TabsTrigger>
            <TabsTrigger
              value="public-access"
              className="h-10 w-full justify-start rounded-lg px-3 text-left font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground data-[state=active]:bg-muted data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              Public access
            </TabsTrigger>
            <TabsTrigger
              value="reset-password"
              className="h-10 w-full justify-start rounded-lg px-3 text-left font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground data-[state=active]:bg-muted data-[state=active]:text-primary data-[state=active]:shadow-none"
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
      <div className="w-full px-5 py-4">
        <div className="grid grid-flow-row gap-y-6">
      <TabsContent value="version" className="mt-0">
        <DatabaseServiceVersionSettings />
      </TabsContent>

      <TabsContent value="capacity" className="mt-0">
        <DatabaseStorageCapacity />
      </TabsContent>

      {isPlatform && (
        <>
          <TabsContent value="point-in-time" className="mt-0">
            <DatabasePiTRSettings />
          </TabsContent>

          <TabsContent
            value="public-access"
            className="mt-0 grid grid-flow-row gap-y-6"
          >
            <DatabaseConnectionInfo />
            <DatabaseAllowedCIDRs />
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
