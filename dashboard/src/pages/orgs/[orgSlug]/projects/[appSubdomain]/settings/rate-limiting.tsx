import type { ReactElement } from 'react';
import {
  SettingsCard,
  SettingsCardFooter,
  SettingsCardHeader,
  SettingsDocsLink,
} from '@/components/layout/SettingsCard';
import { Spinner } from '@/components/ui/v3/spinner';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { AuthLimitingForm } from '@/features/orgs/projects/rate-limiting/settings/components/AuthLimitingForm';
import { RateLimitingForm } from '@/features/orgs/projects/rate-limiting/settings/components/RateLimitingForm';
import { RunServiceLimitingForm } from '@/features/orgs/projects/rate-limiting/settings/components/RunServiceLimitingForm';
import { useGetRateLimits } from '@/features/orgs/projects/rate-limiting/settings/hooks/useGetRateLimits';
import { useGetRunServiceRateLimits } from '@/features/orgs/projects/rate-limiting/settings/hooks/useGetRunServiceRateLimits';

export default function RateLimiting() {
  const { project, loading: loadingProject } = useProject();
  const { services, loading } = useGetRunServiceRateLimits();

  const {
    hasuraDefaultValues,
    functionsDefaultValues,
    storageDefaultValues,
    loading: loadingBaseServices,
  } = useGetRateLimits();

  const isInitialLoading =
    loadingProject || !project?.id || loadingBaseServices || loading;

  if (isInitialLoading) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading rate limit settings...
      </Spinner>
    );
  }

  return (
    <div className="grid grid-flow-row gap-6">
      <SettingsCard>
        <SettingsCardHeader title="Rate Limiting" />
        <SettingsCardFooter>
          <SettingsDocsLink
            href="https://docs.nhost.io/platform/cloud/rate-limits"
            title="Rate Limiting"
          />
        </SettingsCardFooter>
      </SettingsCard>
      <AuthLimitingForm />
      <RateLimitingForm
        defaultValues={hasuraDefaultValues}
        loading={loadingBaseServices}
        serviceName="hasura"
        title="Hasura"
      />
      <RateLimitingForm
        defaultValues={storageDefaultValues}
        loading={loadingBaseServices}
        serviceName="storage"
        title="Storage"
      />
      <RateLimitingForm
        defaultValues={functionsDefaultValues}
        loading={loadingBaseServices}
        serviceName="functions"
        title="Functions"
      />
      {services?.map((service) => {
        if (
          service?.ports?.some((port) => port?.type === 'http' && port?.publish)
        ) {
          return (
            <RunServiceLimitingForm
              enabledDefault={service.enabled}
              key={service.id}
              title={service.name}
              serviceId={service.id}
              ports={service.ports}
              loading={loading}
            />
          );
        }
        return null;
      })}
    </div>
  );
}

RateLimiting.getLayout = function getLayout(page: ReactElement) {
  return (
    <OrgLayout>
      <SettingsLayout>
        <div className="mx-auto w-full max-w-5xl px-5 py-4">{page}</div>
      </SettingsLayout>
    </OrgLayout>
  );
};
