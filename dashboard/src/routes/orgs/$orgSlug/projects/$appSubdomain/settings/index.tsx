import { createFileRoute, redirect } from '@tanstack/react-router';
import type { PropsWithChildren } from 'react';
import {
  AreaSidebarGroup,
  AreaSidebarLink,
  AreaSidebarNav,
  AreaSidebarRoot,
} from '@/components/layout/AreaSidebar';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ProjectStateGate } from '@/features/orgs/guards/ProjectStateGate';
import { SettingsGuard } from '@/features/orgs/guards/SettingsGuard';
import { SettingsArea } from '@/features/orgs/projects/common/components/settings/SettingsArea';
import { TOMLEditor } from '@/features/orgs/projects/common/components/settings/TOMLEditor';
import { EnvironmentVariablesSettings } from '@/features/orgs/projects/environmentVariables/settings/components/EnvironmentVariablesSettings';
import { GeneralSettings } from '@/features/orgs/projects/general/settings/components/GeneralSettings';
import { ComputeResourcesSettings } from '@/features/orgs/projects/resources/settings/components/ComputeResourcesSettings';
import { SecretsSettings } from '@/features/orgs/projects/secrets/settings/components/SecretsSettings';
import { useCurrentHref } from '@/lib/route-navigation';

const projectSettingsTabs = [
  'general',
  'compute-resources',
  'environment-variables',
  'secrets',
  'editor',
] as const;

type ProjectSettingsTab = (typeof projectSettingsTabs)[number];

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/settings/',
)({
  validateSearch: (search): { tab?: ProjectSettingsTab } => ({
    tab: projectSettingsTabs.find((tab) => tab === search.tab),
  }),
  beforeLoad: ({ params, search }) => {
    if (!search.tab) {
      throw redirect({
        to: '/orgs/$orgSlug/projects/$appSubdomain/settings',
        params,
        search: { tab: 'general' },
        replace: true,
      });
    }
  },
  component: RouteComponent,
});

function ProjectSettingsTabContent() {
  const { tab } = Route.useSearch();

  switch (tab) {
    case 'compute-resources':
      return <ComputeResourcesSettings />;
    case 'environment-variables':
      return <EnvironmentVariablesSettings />;
    case 'secrets':
      return <SecretsSettings />;
    case 'editor':
      return <TOMLEditor />;
    default:
      return <GeneralSettings />;
  }
}

function ProjectSettingsSidebar() {
  // Docked against the app sidebar, unlike the area settings pages whose
  // sidebar is centered with the content.
  return (
    <AreaSidebarRoot className="flex flex-col bg-background md:border-r">
      <div className="shrink-0 border-b px-4 py-3 font-medium text-sm">
        Settings
      </div>
      <AreaSidebarNav
        ariaLabel="Project settings navigation"
        className="h-auto min-h-0 flex-1 pt-2 md:overflow-auto"
      >
        <AreaSidebarGroup label="Project">
          <AreaSidebarLink
            from="/orgs/$orgSlug/projects/$appSubdomain"
            to="/orgs/$orgSlug/projects/$appSubdomain/settings"
            params
            search={{ tab: 'general' }}
            exact
            resetScroll={false}
          >
            General
          </AreaSidebarLink>
          <AreaSidebarLink
            from="/orgs/$orgSlug/projects/$appSubdomain"
            to="/orgs/$orgSlug/projects/$appSubdomain/settings"
            params
            search={{ tab: 'compute-resources' }}
            exact
            resetScroll={false}
          >
            Compute Resources
          </AreaSidebarLink>
        </AreaSidebarGroup>
        <AreaSidebarGroup label="Configuration">
          <AreaSidebarLink
            from="/orgs/$orgSlug/projects/$appSubdomain"
            to="/orgs/$orgSlug/projects/$appSubdomain/settings"
            params
            search={{ tab: 'environment-variables' }}
            exact
            resetScroll={false}
          >
            Environment Variables
          </AreaSidebarLink>
          <AreaSidebarLink
            from="/orgs/$orgSlug/projects/$appSubdomain"
            to="/orgs/$orgSlug/projects/$appSubdomain/settings"
            params
            search={{ tab: 'secrets' }}
            exact
            resetScroll={false}
          >
            Secrets
          </AreaSidebarLink>
          <AreaSidebarLink
            from="/orgs/$orgSlug/projects/$appSubdomain"
            to="/orgs/$orgSlug/projects/$appSubdomain/settings"
            params
            search={{ tab: 'editor' }}
            exact
            resetScroll={false}
          >
            Configuration Editor
          </AreaSidebarLink>
        </AreaSidebarGroup>
      </AreaSidebarNav>
    </AreaSidebarRoot>
  );
}

function ProjectSettingsContentLayout({ children }: PropsWithChildren) {
  const { tab } = Route.useSearch();
  const currentHref = useCurrentHref();

  if (tab === 'editor') {
    return (
      <RetryableErrorBoundary resetKeys={[currentHref]}>
        {children}
      </RetryableErrorBoundary>
    );
  }

  return <SettingsArea>{children}</SettingsArea>;
}

function SettingsGeneralPage() {
  return <ProjectSettingsTabContent />;
}

function RouteComponent() {
  return (
    <ProjectStateGate>
      <SettingsGuard>
        <div className="flex h-full min-h-0 flex-col md:flex-row">
          <ProjectSettingsSidebar />
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            <ProjectSettingsContentLayout>
              <SettingsGeneralPage />
            </ProjectSettingsContentLayout>
          </div>
        </div>
      </SettingsGuard>
    </ProjectStateGate>
  );
}
