import { ExternalLink as ArrowSquareOutIcon } from 'lucide-react';
import Link from 'next/link';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Text } from '@/components/ui/v2/Text';
import type { RunService } from '@/features/orgs/projects/common/hooks/useRunServices';
import { RunServicePortDomain } from '@/features/orgs/projects/custom-domains/settings/components/RunServicePortDomain';

import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export interface RunServiceDomainsProps {
  services: RunService[];
}

export default function RunServiceDomains({
  services,
}: RunServiceDomainsProps) {
  const { org } = useCurrentOrg();
  const { project } = useProject();

  return (
    <div className="flex flex-col gap-6">
      {services
        .filter((service) => (service.config?.ports?.length ?? 0) > 0)
        .map((service) => (
          <SettingsContainer
            key={service.id ?? service.serviceID}
            title={
              <div className="flex flex-row items-center">
                <Text className="font-semibold text-lg">
                  {service.config?.name ?? 'unset'}
                </Text>
                <Link
                  href={`/orgs/${org?.slug}/projects/${project?.subdomain}/services`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
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
