import { Container } from '@/components/layout/Container';
import { ProjectLayout } from '@/components/layout/ProjectLayout';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Text } from '@/components/ui/v2/Text';
import { ServiceEnvironmentFormSection } from '@/features/services/components/EditService/ServiceEnvironmentFormSection';
import { ServiceImageFormSection } from '@/features/services/components/EditService/ServiceImageFormSection';
import { ServiceNameFormSection } from '@/features/services/components/EditService/ServiceNameFormSection';
import { useGetRunServiceQuery } from '@/generated/graphql';
import { useRouter } from 'next/router';
import type { ReactElement } from 'react';

export default function ServiceDetailsPage() {
  const {
    query: { serviceId },
  } = useRouter();

  // const { currentProject } = useCurrentWorkspaceAndProject();

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
      className="w-full max-w-none space-y-4"
      sx={{ backgroundColor: 'background.default' }}
    >
      <ServiceNameFormSection name={runService.config.name} />
      <ServiceImageFormSection image={runService.config.image.image} />
      <ServiceEnvironmentFormSection
        environment={runService.config.environment}
      />
    </Container>
  );
}

ServiceDetailsPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
