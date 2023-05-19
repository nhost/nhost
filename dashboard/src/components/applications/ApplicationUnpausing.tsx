import Container from '@/components/layout/Container';
import { useProjectRedirectWhenReady } from '@/features/projects/hooks/useProjectRedirectWhenReady';
import Image from 'next/image';
import { AppLoader } from './AppLoader';

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
