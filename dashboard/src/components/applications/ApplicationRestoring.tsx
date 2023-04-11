import Container from '@/components/layout/Container';
import { useCheckProvisioning } from '@/hooks/useCheckProvisioning';
import { useCurrentWorkspaceAndProject } from '@/hooks/v2/useCurrentWorkspaceAndProject';
import { ApplicationStatus } from '@/types/application';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Text from '@/ui/v2/Text';
import Image from 'next/image';
import { AppLoader } from './AppLoader';
import ApplicationInfo from './ApplicationInfo';
import { StagingMetadata } from './StagingMetadata';

export default function ApplicationRestoring() {
  const currentProjectState = useCheckProvisioning();
  const { currentProject } = useCurrentWorkspaceAndProject();

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
            Setting Up {currentProject.name}
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
