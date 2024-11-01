import { Container } from '@/components/layout/Container';
import { Box } from '@/components/ui/v2/Box';
import { ArrowSquareOutIcon } from '@/components/ui/v2/icons/ArrowSquareOutIcon';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';

import { AuthLimitingForm } from '@/features/orgs/projects/rate-limiting/settings/components/AuthLimitingForm';
import { RateLimitingForm } from '@/features/orgs/projects/rate-limiting/settings/components/RateLimitingForm';
import { RunServiceLimitingForm } from '@/features/orgs/projects/rate-limiting/settings/components/RunServiceLimitingForm';
import { useGetRateLimits } from '@/features/orgs/projects/rate-limiting/settings/hooks/useGetRateLimits';
import { useGetRunServiceRateLimits } from '@/features/orgs/projects/rate-limiting/settings/hooks/useGetRunServiceRateLimits';

import { type ReactElement } from 'react';

export default function RateLimiting() {
  const { services, loading } = useGetRunServiceRateLimits();

  const {
    hasuraDefaultValues,
    functionsDefaultValues,
    storageDefaultValues,
    loading: loadingBaseServices,
  } = useGetRateLimits();

  return (
    <Container
      className="grid max-w-5xl grid-flow-row gap-6 bg-transparent"
      rootClassName="bg-transparent"
    >
      <Box className="flex flex-row items-center gap-4 overflow-hidden rounded-lg border-1 p-4">
        <div className="flex flex-col space-y-2">
          <Text className="text-lg font-semibold">Rate Limiting</Text>

          <Text color="secondary">
            Learn more about
            <Link
              href="https://docs.nhost.io/platform/rate-limits"
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
              className="ml-1 font-medium"
            >
              Rate Limiting
              <ArrowSquareOutIcon className="ml-1 h-4 w-4" />
            </Link>
          </Text>
        </div>
      </Box>
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
    </Container>
  );
}

RateLimiting.getLayout = function getLayout(page: ReactElement) {
  return (
    <ProjectLayout
      mainContainerProps={{
        className: 'flex h-full overflow-auto',
      }}
    >
      <SettingsLayout>
        <Container
          sx={{ backgroundColor: 'background.default' }}
          className="max-w-5xl"
        >
          {page}
        </Container>
      </SettingsLayout>
    </ProjectLayout>
  );
};
