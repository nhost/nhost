import { useRouter } from 'next/router';
import { type ReactElement, useEffect } from 'react';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  AreaSidebarGroup,
  AreaSidebarLink,
  AreaSidebarNav,
  AreaSidebarRoot,
} from '@/components/layout/AreaSidebar';
import { Spinner } from '@/components/ui/v3/spinner';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import { SettingsGuard } from '@/features/orgs/guards/SettingsGuard';
import { SettingsArea } from '@/features/orgs/projects/common/components/settings/SettingsArea';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { CustomDomainsNotice } from '@/features/orgs/projects/custom-domains/settings/components/CustomDomainsNotice';
import { ServerlessFunctionsDomain } from '@/features/orgs/projects/custom-domains/settings/components/ServerlessFunctionsDomain';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { RateLimitingForm } from '@/features/orgs/projects/rate-limiting/settings/components/RateLimitingForm';
import { useGetRateLimits } from '@/features/orgs/projects/rate-limiting/settings/hooks/useGetRateLimits';
import { FunctionsArea } from '@/features/orgs/projects/serverless-functions/layout';
import { useGetServerlessFunctionsSettingsQuery } from '@/generated/graphql';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

function FunctionsCustomDomainSettings() {
  const { org } = useCurrentOrg();
  const { project, loading: loadingProject } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const shouldShowUpgrade = isPlatform && !!org?.plan?.isFree;

  const { data, error } = useGetServerlessFunctionsSettingsQuery({
    variables: { appId: project?.id },
    skip: shouldShowUpgrade || !project?.id,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (shouldShowUpgrade) {
    return (
      <UpgradeToProBanner
        section="settings-custom-domains"
        title="To unlock Custom Domains, transfer this project to a Pro or Team organization."
        description=""
      />
    );
  }

  if (error) {
    throw error;
  }

  const isInitialLoading = loadingProject || !project?.id || !data;

  if (isInitialLoading) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading Functions custom domain settings...
      </Spinner>
    );
  }

  return (
    <div className="grid grid-flow-row gap-6">
      <CustomDomainsNotice />
      <ServerlessFunctionsDomain />
    </div>
  );
}

function FunctionsRateLimitingSettings() {
  const { project, loading: loadingProject } = useProject();
  const { functionsDefaultValues, loading } = useGetRateLimits();

  if (loadingProject || !project?.id || loading) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading Functions rate limit settings...
      </Spinner>
    );
  }

  return (
    <RateLimitingForm
      defaultValues={functionsDefaultValues}
      loading={loading}
      serviceName="functions"
      title="Functions"
    />
  );
}

function FunctionsSettingsSidebar() {
  const router = useRouter();
  const orgSlug = getSingleQueryParam(router.query.orgSlug);
  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);

  if (!orgSlug || !appSubdomain) {
    return null;
  }

  const settingsPath = `/orgs/${orgSlug}/projects/${appSubdomain}/functions/settings`;

  return (
    <AreaSidebarRoot>
      <AreaSidebarNav ariaLabel="Functions settings navigation">
        <AreaSidebarGroup label="Connectivity">
          <AreaSidebarLink
            href={`${settingsPath}?tab=custom-domain`}
            exact
            shallow
            scroll={false}
          >
            Custom Domain
          </AreaSidebarLink>
          <AreaSidebarLink
            href={`${settingsPath}?tab=rate-limiting`}
            exact
            shallow
            scroll={false}
          >
            Rate Limiting
          </AreaSidebarLink>
        </AreaSidebarGroup>
      </AreaSidebarNav>
    </AreaSidebarRoot>
  );
}

export default function FunctionsSettingsPage() {
  const router = useRouter();
  const tab = getSingleQueryParam(router.query.tab);
  const isValidTab = tab === 'rate-limiting' || tab === 'custom-domain';

  useEffect(() => {
    if (!router.isReady || isValidTab) {
      return;
    }

    void router.replace(
      {
        pathname: router.pathname,
        query: { ...router.query, tab: 'custom-domain' },
      },
      undefined,
      { shallow: true },
    );
  }, [isValidTab, router]);

  if (!isValidTab) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  switch (tab) {
    case 'rate-limiting':
      return <FunctionsRateLimitingSettings />;
    default:
      return <FunctionsCustomDomainSettings />;
  }
}

FunctionsSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <FunctionsArea>
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col pt-8 md:flex-row">
            <FunctionsSettingsSidebar />
            <div className="min-w-0 flex-1">
              <SettingsGuard>
                <SettingsArea className="pt-0">{page}</SettingsArea>
              </SettingsGuard>
            </div>
          </div>
        </FunctionsArea>
      </ProjectScope>
    </AppLayout>
  );
};
