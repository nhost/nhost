import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { ArrowSquareOutIcon } from '@/components/ui/v2/icons/ArrowSquareOutIcon';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import { RunServicePortDomain } from '@/features/orgs/projects/custom-domains/settings/components/RunServicePortDomain';
import { useRunServices } from '@/features/orgs/projects/services/hooks/useRunServices';

import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function RunServiceDomains() {
  const { org } = useCurrentOrg();
  const { project } = useProject();
  const { services, loading } = useRunServices();

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading Run Services Domains..."
        className="justify-center"
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {services
        .filter((service) => service.config?.ports?.length > 0)
        .map((service) => (
          <SettingsContainer
            key={service.id ?? service.serviceID}
            title={
              <div className="flex flex-row items-center">
                <Text className="text-lg font-semibold">
                  {service.config?.name ?? 'unset'}
                </Text>
                <Link
                  href={`/orgs/${org?.slug}/projects/${project?.subdomain}/services`}
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="hover"
                  className="font-medium"
                >
                  <ArrowSquareOutIcon className="mb-1 ml-1 h-4 w-4" />
                </Link>
              </div>
            }
            description="Enter below your custom domain for the published ports."
            docsTitle={service.config?.name ?? 'unset'}
            slotProps={{
              submitButton: {
                hidden: true,
              },
              footer: {
                className: 'hidden',
              },
            }}
            className="grid gap-x-4 gap-y-4 px-4"
          >
            {service.config?.ports?.map((port) => (
              <RunServicePortDomain
                key={String(port.port)}
                service={service}
                port={port.port}
              />
            ))}
          </SettingsContainer>
        ))}
    </div>
  );
}
