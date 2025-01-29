import { Container } from '@/components/layout/Container';
import { AppLoader } from '@/features/orgs/projects/common/components/AppLoader';
import { useProjectRedirectWhenReady } from '@/features/orgs/projects/common/hooks/useProjectRedirectWhenReady';
import Image from 'next/image';

export default function ApplicationUnpausing() {
  useProjectRedirectWhenReady({ pollInterval: 2000 });

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
      <AppLoader startLoader unpause />
    </Container>
  );
}
