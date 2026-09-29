import { useRouter } from 'next/router';
import { type PropsWithChildren, type ReactElement, useEffect } from 'react';
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
import { TOMLEditor } from '@/features/orgs/projects/common/components/settings/TOMLEditor';
import { EnvironmentVariablesSettings } from '@/features/orgs/projects/environmentVariables/settings/components/EnvironmentVariablesSettings';
import { GeneralSettings } from '@/features/orgs/projects/general/settings/components/GeneralSettings';
import { ComputeResourcesSettings } from '@/features/orgs/projects/resources/settings/components/ComputeResourcesSettings';
import { SecretsSettings } from '@/features/orgs/projects/secrets/settings/components/SecretsSettings';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

function RedirectToGeneralTab() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    void router.replace(
      { pathname: router.pathname, query: { ...router.query, tab: 'general' } },
      undefined,
      { shallow: true },
    );
  }, [router]);

  return null;
}

function ProjectSettingsTabContent() {
  const router = useRouter();

  switch (getSingleQueryParam(router.query.tab)) {
    case 'general':
      return <GeneralSettings />;
    case 'compute-resources':
      return <ComputeResourcesSettings />;
    case 'environment-variables':
      return <EnvironmentVariablesSettings />;
    case 'secrets':
      return <SecretsSettings />;
    case 'editor':
      return <TOMLEditor />;
    default:
      return <RedirectToGeneralTab />;
  }
}

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
        className="h-auto min-h-0 flex-1 md:overflow-auto"
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
            href={`${settingsPath}?tab=editor`}
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

  if (getSingleQueryParam(router.query.tab) === 'editor') {
    return (
      <RetryableErrorBoundary resetKeys={[router.asPath]}>
        {children}
      </RetryableErrorBoundary>
    );
  }

  return <SettingsArea>{children}</SettingsArea>;
}

export default function SettingsGeneralPage() {
  return <ProjectSettingsTabContent />;
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
