import { createFileRoute, redirect } from '@tanstack/react-router';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { Spinner } from '@/components/ui/v3/spinner';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { AreaSettingsLayout } from '@/features/orgs/projects/common/layout/AreaSettingsLayout';
import { CustomDomainsNotice } from '@/features/orgs/projects/custom-domains/settings/components/CustomDomainsNotice';
import { DatabaseDomain } from '@/features/orgs/projects/custom-domains/settings/components/DatabaseDomain';
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
import { isPlatform as isPlatformFn } from '@/utils/env';

const databaseSettingsTabs = [
  'version',
  'capacity',
  'point-in-time',
  'access',
  'custom-domain',
  'reset-password',
] as const;

type DatabaseSettingsTab = (typeof databaseSettingsTabs)[number];

const platformOnlyTabs: DatabaseSettingsTab[] = [
  'point-in-time',
  'access',
  'custom-domain',
  'reset-password',
];

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/database/settings',
)({
  validateSearch: (search): { tab?: DatabaseSettingsTab } => ({
    tab: databaseSettingsTabs.find((tab) => tab === search.tab),
  }),
  beforeLoad: ({ params, search }) => {
    if (
      !search.tab ||
      (!isPlatformFn() && platformOnlyTabs.includes(search.tab))
    ) {
      throw redirect({
        to: '/orgs/$orgSlug/projects/$appSubdomain/database/settings',
        params,
        search: { tab: 'version' },
        replace: true,
      });
    }
  },
  component: RouteComponent,
});

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

function DatabaseSettingsPage() {
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { project, loading: loadingProject } = useProject();
  const { tab } = Route.useSearch();

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

function RouteComponent() {
  return (
    <AreaSettingsLayout sidebar={<DatabaseSettingsNavigation />}>
      <DatabaseSettingsPage />
    </AreaSettingsLayout>
  );
}
