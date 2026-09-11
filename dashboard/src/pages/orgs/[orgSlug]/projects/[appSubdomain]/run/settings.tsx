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
import {
  SettingsCard,
  SettingsCardFooter,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
import { Spinner } from '@/components/ui/v3/spinner';
import { TextLink } from '@/components/ui/v3/text-link';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import { SettingsGuard } from '@/features/orgs/guards/SettingsGuard';
import { SettingsArea } from '@/features/orgs/projects/common/components/settings/SettingsArea';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useRunServices } from '@/features/orgs/projects/common/hooks/useRunServices';
import { CustomDomainsNotice } from '@/features/orgs/projects/custom-domains/settings/components/CustomDomainsNotice';
import { RunServiceDomains } from '@/features/orgs/projects/custom-domains/settings/components/RunServiceDomains';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { RunServiceLimitingForm } from '@/features/orgs/projects/rate-limiting/settings/components/RunServiceLimitingForm';
import { useGetRunServiceRateLimits } from '@/features/orgs/projects/rate-limiting/settings/hooks/useGetRunServiceRateLimits';
import { RunArea } from '@/features/orgs/projects/run/layout';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

interface NoRunServicesProps {
  title?: string;
  description?: string;
}

function NoRunServices({
  title = 'No Run services yet',
  description,
}: NoRunServicesProps) {
  const router = useRouter();
  const orgSlug = getSingleQueryParam(router.query.orgSlug);
  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);

  return (
    <SettingsCard>
      <SettingsCardHeader title={title} description={description} />
      <SettingsCardFooter>
        <TextLink href={`/orgs/${orgSlug}/projects/${appSubdomain}/run`}>
          Go to Services
        </TextLink>
      </SettingsCardFooter>
    </SettingsCard>
  );
}

function RunCustomDomainSettings() {
  const isPlatform = useIsPlatform();
  const { org } = useCurrentOrg();
  const { project, loading: loadingProject } = useProject();
  const { services, loading, error } = useRunServices();

  if (isPlatform && org?.plan?.isFree) {
    return (
      <UpgradeToProBanner
        section="settings-custom-domains"
        title="To unlock Custom Domains, transfer this project to a Pro or Team organization."
        description=""
      />
    );
  }

  if (loadingProject || !project?.id || loading) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading Run custom domain settings...
      </Spinner>
    );
  }

  if (error) {
    throw error;
  }

  const hasServicesWithPorts = services.some(
    (service) => (service.config?.ports?.length ?? 0) > 0,
  );

  return (
    <div className="grid grid-flow-row gap-6">
      <CustomDomainsNotice />
      {hasServicesWithPorts && <RunServiceDomains services={services} />}
      {!hasServicesWithPorts && services.length === 0 && <NoRunServices />}
      {!hasServicesWithPorts && services.length > 0 && (
        <NoRunServices
          title="No Run services with ports"
          description="Custom domains are assigned to service ports. Add a port to one of your Run services to configure its domain."
        />
      )}
    </div>
  );
}

function RunRateLimitingSettings() {
  const { project, loading: loadingProject } = useProject();
  const { services, loading, error } = useGetRunServiceRateLimits();

  if (loadingProject || !project?.id || loading) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading Run rate limit settings...
      </Spinner>
    );
  }

  if (error) {
    throw error;
  }

  const limitableServices = (services ?? []).filter((service) =>
    service?.ports?.some((port) => port?.type === 'http' && port?.publish),
  );

  if (!services?.length) {
    return <NoRunServices />;
  }

  if (limitableServices.length === 0) {
    return (
      <NoRunServices
        title="No published HTTP ports"
        description="Rate limiting applies to published HTTP ports. Publish an HTTP port on one of your Run services to configure its rate limits."
      />
    );
  }

  return (
    <div className="grid grid-flow-row gap-6">
      {limitableServices.map((service) => (
        <RunServiceLimitingForm
          enabledDefault={service.enabled}
          key={service.id}
          title={service.name}
          serviceId={service.id}
          ports={service.ports}
          loading={loading}
        />
      ))}
    </div>
  );
}

function RunSettingsSidebar() {
  const router = useRouter();
  const orgSlug = getSingleQueryParam(router.query.orgSlug);
  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);

  if (!orgSlug || !appSubdomain) {
    return null;
  }

  const settingsPath = `/orgs/${orgSlug}/projects/${appSubdomain}/run/settings`;

  return (
    <AreaSidebarRoot>
      <AreaSidebarNav ariaLabel="Run settings navigation">
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

export default function RunSettingsPage() {
  const router = useRouter();
  const tab = getSingleQueryParam(router.query.tab);
  const isValidTab = tab === 'custom-domain' || tab === 'rate-limiting';

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
      return <RunRateLimitingSettings />;
    default:
      return <RunCustomDomainSettings />;
  }
}

RunSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <RunArea>
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col md:flex-row">
            <RunSettingsSidebar />
            <div className="min-w-0 flex-1">
              <SettingsGuard>
                <SettingsArea>{page}</SettingsArea>
              </SettingsGuard>
            </div>
          </div>
        </RunArea>
      </ProjectScope>
    </AppLayout>
  );
};
