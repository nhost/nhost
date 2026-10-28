import { useRouter } from 'next/router';
import type { PropsWithChildren, ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  AreaSidebarGroup,
  AreaSidebarLink,
  AreaSidebarNav,
  AreaSidebarRoot,
} from '@/components/layout/AreaSidebar';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import { ProjectStateGate } from '@/features/orgs/guards/ProjectStateGate';
import { SettingsGuard } from '@/features/orgs/guards/SettingsGuard';
import { SettingsArea } from '@/features/orgs/projects/common/components/settings/SettingsArea';
import {
  type SettingsTab,
  SettingsTabs,
} from '@/features/orgs/projects/common/components/settings/SettingsTabs';
import { TOMLEditor } from '@/features/orgs/projects/common/components/settings/TOMLEditor';
import { EnvironmentVariablesSettings } from '@/features/orgs/projects/environmentVariables/settings/components/EnvironmentVariablesSettings';
import { GeneralSettings } from '@/features/orgs/projects/general/settings/components/GeneralSettings';
import { ComputeResourcesSettings } from '@/features/orgs/projects/resources/settings/components/ComputeResourcesSettings';
import { SecretsSettings } from '@/features/orgs/projects/secrets/settings/components/SecretsSettings';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

/**
 * The configuration editor runs full width, without a title or the settings
 * column, so it is rendered apart from the other tabs.
 */
const EDITOR_TAB = 'editor';

const PROJECT_SETTINGS_TABS = {
  general: { title: 'General', Component: GeneralSettings },
  'compute-resources': {
    title: 'Compute Resources',
    Component: ComputeResourcesSettings,
  },
  'environment-variables': {
    title: 'Environment Variables',
    Component: EnvironmentVariablesSettings,
  },
  secrets: { title: 'Secrets', Component: SecretsSettings },
} satisfies Record<string, SettingsTab>;

function ProjectSettingsSidebar() {
  const router = useRouter();
  const orgSlug = getSingleQueryParam(router.query.orgSlug);
  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);

  if (!orgSlug || !appSubdomain) {
    return null;
  }

  const settingsPath = `/orgs/${orgSlug}/projects/${appSubdomain}/settings`;

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
            href={`${settingsPath}?tab=general`}
            exact
            shallow
            scroll={false}
          >
            General
          </AreaSidebarLink>
          <AreaSidebarLink
            href={`${settingsPath}?tab=compute-resources`}
            exact
            shallow
            scroll={false}
          >
            Compute Resources
          </AreaSidebarLink>
        </AreaSidebarGroup>
        <AreaSidebarGroup label="Configuration">
          <AreaSidebarLink
            href={`${settingsPath}?tab=environment-variables`}
            exact
            shallow
            scroll={false}
          >
            Environment Variables
          </AreaSidebarLink>
          <AreaSidebarLink
            href={`${settingsPath}?tab=secrets`}
            exact
            shallow
            scroll={false}
          >
            Secrets
          </AreaSidebarLink>
          <AreaSidebarLink
            href={`${settingsPath}?tab=${EDITOR_TAB}`}
            exact
            shallow
            scroll={false}
          >
            Configuration Editor
          </AreaSidebarLink>
        </AreaSidebarGroup>
      </AreaSidebarNav>
    </AreaSidebarRoot>
  );
}

function ProjectSettingsContentLayout({ children }: PropsWithChildren) {
  const router = useRouter();

  if (getSingleQueryParam(router.query.tab) === EDITOR_TAB) {
    return (
      <RetryableErrorBoundary resetKeys={[router.asPath]}>
        {children}
      </RetryableErrorBoundary>
    );
  }

  return <SettingsArea>{children}</SettingsArea>;
}

export default function SettingsGeneralPage() {
  const router = useRouter();

  if (getSingleQueryParam(router.query.tab) === EDITOR_TAB) {
    return <TOMLEditor />;
  }

  return <SettingsTabs tabs={PROJECT_SETTINGS_TABS} defaultTab="general" />;
}

SettingsGeneralPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <ProjectStateGate>
          <SettingsGuard>
            <div className="flex h-full min-h-0 flex-col md:flex-row">
              <ProjectSettingsSidebar />
              <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
                <ProjectSettingsContentLayout>
                  {page}
                </ProjectSettingsContentLayout>
              </div>
            </div>
          </SettingsGuard>
        </ProjectStateGate>
      </ProjectScope>
    </AppLayout>
  );
};
