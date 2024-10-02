import { Container } from '@/components/layout/Container';
import { AppLoader } from '@/features/orgs/projects/common/components/AppLoader';
import { useProjectRedirectWhenReady } from '@/features/orgs/projects/common/hooks/useProjectRedirectWhenReady';
import Image from 'next/image';

export default function ApplicationUnpausing() {
  useProjectRedirectWhenReady({ pollInterval: 2000 });

  return (
    <Container className="grid max-w-sm grid-flow-row gap-4 mx-auto mt-8 text-center">
      <div className="flex flex-col mx-auto text-center w-centImage">
        <Image
          src="/terminal-text.svg"
          alt="Terminal with a green dot"
          width={72}
          height={72}
        />
      </div>
      <AppLoader startLoader unpause />
    </Container>
  );
}
