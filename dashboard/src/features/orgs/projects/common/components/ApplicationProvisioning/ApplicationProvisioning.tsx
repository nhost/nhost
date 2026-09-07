import Image from 'next/image';
import { Container } from '@/components/layout/Container';
import { Spinner } from '@/components/ui/v3/spinner';
import { AppLoader } from '@/features/orgs/projects/common/components/AppLoader';
import { ApplicationInfo } from '@/features/orgs/projects/common/components/ApplicationInfo';
import { StagingMetadata } from '@/features/orgs/projects/common/components/StagingMetadata';
import { useCheckProvisioning } from '@/features/orgs/projects/common/hooks/useCheckProvisioning';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { ApplicationStatus } from '@/types/application';

export default function ApplicationProvisioning() {
  const { project } = useProject();
  const currentProjectState = useCheckProvisioning();

  return (
    <Container className="mx-auto mt-12 grid max-w-md grid-flow-row gap-8 text-center">
      <div className="mx-auto flex w-centImage flex-col text-center">
        <Image
          src="/terminal-text.svg"
          alt="Terminal with a green dot"
          width={72}
          height={72}
        />
      </div>

      {currentProjectState.state === ApplicationStatus.Empty ? (
        <div className="grid grid-flow-row gap-2">
          <h1 className="font-medium text-foreground text-lg">
            Setting Up {project?.name}
          </h1>
          <p className="text-muted-foreground text-sm">
            This normally takes around 2 minutes
          </p>
          <Spinner size="xs" wrapperClassName="mt-2" />
        </div>
      ) : (
        <AppLoader startLoader date={currentProjectState.createdAt} />
      )}

      <StagingMetadata>
        <ApplicationInfo />
      </StagingMetadata>
    </Container>
  );
}
