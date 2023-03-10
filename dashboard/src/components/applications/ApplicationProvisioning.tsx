import Container from '@/components/layout/Container';
import { useCheckProvisioning } from '@/hooks/useCheckProvisioning';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { ApplicationStatus } from '@/types/application';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Text from '@/ui/v2/Text';
import Image from 'next/image';
import ApplicationInfo from './ApplicationInfo';
import { AppLoader } from './AppLoader';
import { StagingMetadata } from './StagingMetadata';

export default function ApplicationProvisioning() {
  const currentApplicationState = useCheckProvisioning();
  const { currentApplication } = useCurrentWorkspaceAndApplication();

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

      {currentApplicationState.state === ApplicationStatus.Empty ? (
        <div className="grid grid-flow-row gap-1">
          <Text variant="h3" component="h1">
            Setting Up {currentApplication.name}
          </Text>
          <Text>This normally takes around 2 minutes</Text>
          <ActivityIndicator className="mx-auto" />
        </div>
      ) : (
        <AppLoader startLoader date={currentApplicationState.createdAt} />
      )}

      <StagingMetadata>
        <ApplicationInfo />
      </StagingMetadata>
    </Container>
  );
}
