import Container from '@/components/layout/Container';
import { useCheckProvisioning } from '@/hooks/useCheckProvisioning';
import Image from 'next/image';
import ApplicationInfo from './ApplicationInfo';
import { AppLoader } from './AppLoader';
import { StagingMetadata } from './StagingMetadata';

export default function ApplicationProvisioning() {
  const currentApplicationState = useCheckProvisioning();

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

      <AppLoader startLoader date={currentApplicationState.createdAt} />

      <StagingMetadata>
        <ApplicationInfo />
      </StagingMetadata>
    </Container>
  );
}
