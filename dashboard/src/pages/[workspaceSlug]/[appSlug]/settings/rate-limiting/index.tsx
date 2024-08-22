import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { Container } from '@/components/layout/Container';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { Box } from '@/components/ui/v2/Box';
import { ArrowSquareOutIcon } from '@/components/ui/v2/icons/ArrowSquareOutIcon';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { AuthLimitingForm } from '@/features/projects/rate-limiting/settings/components/AuthLimitingForm';
import { FunctionsLimitingForm } from '@/features/projects/rate-limiting/settings/components/FunctionsLimitingForm';
import { HasuraLimitingForm } from '@/features/projects/rate-limiting/settings/components/HasuraLimitingForm';
import { RunServiceLimitingForm } from '@/features/projects/rate-limiting/settings/components/RunServiceLimitingForm';
import { StorageLimitingForm } from '@/features/projects/rate-limiting/settings/components/StorageLimitingForm';
import { useGetRunServiceRateLimits } from '@/features/projects/rate-limiting/settings/hooks/useGetRunServiceRateLimits';
import { type ReactElement } from 'react';

export default function RateLimiting() {
  const { currentProject } = useCurrentWorkspaceAndProject();

  const { services, loading } = useGetRunServiceRateLimits();

  if (currentProject?.plan?.isFree) {
    return (
      <Container
        className="grid grid-flow-row gap-6 bg-transparent"
        rootClassName="bg-transparent"
      >
        <UpgradeToProBanner
          title="Upgrade to Nhost Pro to unlock custom domains"
          description=""
        />
      </Container>
    );
  }

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
              href="https://docs.nhost.io/platform/custom-domains"
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
      <HasuraLimitingForm />
      <StorageLimitingForm />
      <FunctionsLimitingForm />
      {services.map((service) => {
        if (
          !service.ports.some((port) => port.type === 'http' && port.publish)
        ) {
          return null;
        }
        return (
          <RunServiceLimitingForm
            key={service.id}
            title={service.name}
            serviceId={service.id}
            ports={service.ports}
            loading={loading}
          />
        );
      })}
    </Container>
  );
}

RateLimiting.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};
