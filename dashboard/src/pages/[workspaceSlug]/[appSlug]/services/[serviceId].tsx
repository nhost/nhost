import { Container } from '@/components/layout/Container';
import { ProjectLayout } from '@/components/layout/ProjectLayout';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';
import { EditServiceCommand } from '@/features/services/components/edit/EditServiceCommand';
import { EditServiceCompute } from '@/features/services/components/edit/EditServiceCompute';
import { EditServiceEnvironment } from '@/features/services/components/edit/EditServiceEnvironment';
import { EditServiceImage } from '@/features/services/components/edit/EditServiceImage';
import { EditServiceName } from '@/features/services/components/edit/EditServiceName';
import { EditServicePorts } from '@/features/services/components/edit/EditServicePorts';
import { EditServiceReplicas } from '@/features/services/components/edit/EditServiceReplicas';
import { EditServiceStorage } from '@/features/services/components/edit/EditServiceStorage';
import type { PortTypes } from '@/features/services/components/ServiceForm';

import { useGetRunServiceQuery } from '@/generated/graphql';
import { useRouter } from 'next/router';
import type { ReactElement } from 'react';

export default function ServiceDetailsPage() {
  const {
    query: { serviceId },
  } = useRouter();

  const { data, error, loading } = useGetRunServiceQuery({
    variables: {
      id: serviceId,
      resolve: false,
    },
  });

  if (loading) {
    return (
      <Container>
        <ActivityIndicator delay={500} label="Loading sercice details..." />
      </Container>
    );
  }

  if (error) {
    throw error;
  }

  const { runService } = data;

  // TODO work on the empty state
  if (!runService) {
    return (
      <Container>
        <Text variant="h1" className="text text-4xl font-semibold">
          Not found
        </Text>
        <Text className="text-sm" color="disabled">
          This service does not exist.
        </Text>
      </Container>
    );
  }

  return (
    <Container
      className="max-w-none"
      sx={{ backgroundColor: 'background.default' }}
    >
      <Box
        className="mx-auto max-w-7xl space-y-4 px-5"
        sx={{ backgroundColor: 'background.default' }}
      >
        <EditServiceName name={runService.config.name} />
        <EditServiceImage image={runService.config.image.image} />
        <EditServiceCompute compute={runService.config.resources.compute} />
        <EditServiceReplicas replicas={runService.config.resources.replicas} />
        <EditServiceCommand
          command={runService.config.command.map((item) => ({ command: item }))}
        />
        <EditServiceEnvironment environment={runService.config.environment} />
        <EditServicePorts
          name={runService.config.name}
          ports={runService.config.ports.map((port) => ({
            port: port.port,
            type: port.type as PortTypes,
            publish: port.publish,
          }))}
        />
        <EditServiceStorage storage={runService.config.resources.storage} />
      </Box>
    </Container>
  );
}

ServiceDetailsPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
