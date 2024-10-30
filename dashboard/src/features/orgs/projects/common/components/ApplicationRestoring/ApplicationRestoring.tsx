import { Container } from '@/components/layout/Container';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Text } from '@/components/ui/v2/Text';
import { ApplicationInfo } from '@/features/orgs/projects/common/components/ApplicationInfo';
import { AppLoader } from '@/features/orgs/projects/common/components/AppLoader';
import { StagingMetadata } from '@/features/orgs/projects/common/components/StagingMetadata';
import { useCheckProvisioning } from '@/features/orgs/projects/common/hooks/useCheckProvisioning';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { ApplicationStatus } from '@/types/application';
import Image from 'next/image';

export default function ApplicationRestoring() {
  const { project } = useProject();
  const currentProjectState = useCheckProvisioning();

  return (
    <Container className="mx-auto mt-8 grid max-w-sm grid-flow-row gap-4 text-center">
      <div className="mx-auto flex w-centImage flex-col text-center">
        <Image
          src="/terminal-text.svg"
          alt="Terminal with a green dot"
          width={72}
          height={72}
        />
      </div>
      {currentProjectState.state === ApplicationStatus.Empty ? (
        <div className="grid grid-flow-row gap-1">
          <Text variant="h3" component="h1">
            Setting Up {project?.name}
          </Text>

          <Text>This normally takes around 2 minutes</Text>

          <ActivityIndicator className="mx-auto" />
        </div>
      ) : (
        <AppLoader startLoader restoring date={currentProjectState.createdAt} />
      )}
      <StagingMetadata>
        <ApplicationInfo />
      </StagingMetadata>
    </Container>
  );
}
