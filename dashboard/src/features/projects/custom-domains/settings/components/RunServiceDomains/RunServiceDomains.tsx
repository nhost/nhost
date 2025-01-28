import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { ArrowSquareOutIcon } from '@/components/ui/v2/icons/ArrowSquareOutIcon';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { RunServicePortDomain } from '@/features/projects/custom-domains/settings/components/RunServicePortDomain';
import { useRunServices } from '@/hooks/useRunServices';

export default function RunServiceDomains() {
  const { currentProject, currentWorkspace } = useCurrentWorkspaceAndProject();

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
                  href={`/${currentWorkspace.slug}/${currentProject.slug}/services`}
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
