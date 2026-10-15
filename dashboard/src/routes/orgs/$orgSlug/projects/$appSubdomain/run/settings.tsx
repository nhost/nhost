import { createFileRoute, redirect } from '@tanstack/react-router';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
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
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useRunServices } from '@/features/orgs/projects/common/hooks/useRunServices';
import { AreaSettingsLayout } from '@/features/orgs/projects/common/layout/AreaSettingsLayout';
import { CustomDomainsNotice } from '@/features/orgs/projects/custom-domains/settings/components/CustomDomainsNotice';
import { RunServiceDomains } from '@/features/orgs/projects/custom-domains/settings/components/RunServiceDomains';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { RunServiceLimitingForm } from '@/features/orgs/projects/rate-limiting/settings/components/RunServiceLimitingForm';
import { useGetRunServiceRateLimits } from '@/features/orgs/projects/rate-limiting/settings/hooks/useGetRunServiceRateLimits';

const runSettingsTabs = ['custom-domain', 'rate-limiting'] as const;

type RunSettingsTab = (typeof runSettingsTabs)[number];

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/run/settings',
)({
  validateSearch: (search): { tab?: RunSettingsTab } => ({
    tab: runSettingsTabs.find((tab) => tab === search.tab),
  }),
  beforeLoad: ({ params, search }) => {
    if (!search.tab) {
      throw redirect({
        to: '/orgs/$orgSlug/projects/$appSubdomain/run/settings',
        params,
        search: { tab: 'custom-domain' },
        replace: true,
      });
    }
  },
  component: RouteComponent,
});

interface NoRunServicesProps {
  title?: string;
  description?: string;
}

function NoRunServices({
  title = 'No Run services yet',
  description,
}: NoRunServicesProps) {
  return (
    <SettingsCard>
      <SettingsCardHeader title={title} description={description} />
      <SettingsCardFooter>
        <TextLink
          from="/orgs/$orgSlug/projects/$appSubdomain"
          to="/orgs/$orgSlug/projects/$appSubdomain/run"
          params
        >
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
  return (
    <AreaSidebarRoot>
      <AreaSidebarNav ariaLabel="Run settings navigation">
        <AreaSidebarGroup label="Connectivity">
          <AreaSidebarLink
            from="/orgs/$orgSlug/projects/$appSubdomain"
            to="/orgs/$orgSlug/projects/$appSubdomain/run/settings"
            params
            search={{ tab: 'custom-domain' }}
            exact
            resetScroll={false}
          >
            Custom Domain
          </AreaSidebarLink>
          <AreaSidebarLink
            from="/orgs/$orgSlug/projects/$appSubdomain"
            to="/orgs/$orgSlug/projects/$appSubdomain/run/settings"
            params
            search={{ tab: 'rate-limiting' }}
            exact
            resetScroll={false}
          >
            Rate Limiting
          </AreaSidebarLink>
        </AreaSidebarGroup>
      </AreaSidebarNav>
    </AreaSidebarRoot>
  );
}

function RunSettingsPage() {
  const { tab } = Route.useSearch();

  switch (tab) {
    case 'rate-limiting':
      return <RunRateLimitingSettings />;
    default:
      return <RunCustomDomainSettings />;
  }
}

function RouteComponent() {
  return (
    <AreaSettingsLayout sidebar={<RunSettingsSidebar />}>
      <RunSettingsPage />
    </AreaSettingsLayout>
  );
}
