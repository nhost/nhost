import { InviteNotification } from '@/components/common/InviteNotification';
import type { BaseLayoutProps } from '@/components/layout/BaseLayout';
import { BaseLayout } from '@/components/layout/BaseLayout';
import { Container } from '@/components/layout/Container';
import { Header } from '@/components/layout/Header';
import { MainNav } from '@/components/layout/MainNav';
import { useTreeNavState } from '@/components/layout/MainNav/TreeNavStateContext';
import { HighlightedText } from '@/components/presentational/HighlightedText';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { useAuthenticationStatus } from '@nhost/nextjs';

import { useMediaQuery } from '@/components/common/useMediaQuery';
import PinnedMainNav from '@/components/layout/MainNav/PinnedMainNav';
import { OrgStatus } from '@/features/orgs/components/OrgStatus';
import { useIsHealthy } from '@/features/orgs/projects/common/hooks/useIsHealthy';
import { useNotFoundRedirect } from '@/features/projects/common/hooks/useNotFoundRedirect';
import Image from 'next/image';
import { useRouter } from 'next/router';
import {
  useEffect,
  useState,
  type DetailedHTMLProps,
  type HTMLProps,
} from 'react';

export interface AuthenticatedLayoutProps extends BaseLayoutProps {
  /**
   * Props passed to the internal content container.
   */
  contentContainerProps?: DetailedHTMLProps<
    HTMLProps<HTMLDivElement>,
    HTMLDivElement
  >;
}

export default function AuthenticatedLayout({
  children,
  ...props
}: AuthenticatedLayoutProps) {
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const isMdOrLarger = useMediaQuery('md');

  const { isAuthenticated, isLoading } = useAuthenticationStatus();
  const isHealthy = useIsHealthy();
  const [mainNavContainer, setMainNavContainer] = useState(null);
  const { mainNavPinned } = useTreeNavState();

  useNotFoundRedirect();

  useEffect(() => {
    if (!isPlatform || isLoading || isAuthenticated) {
      return;
    }

    router.push('/signin');
  }, [isLoading, isAuthenticated, router, isPlatform]);

  useEffect(() => {
    if (isPlatform || !router.isReady) {
      return;
    }

    if (
      router.query.orgSlug === 'local' &&
      router.query.appSubdomain === 'local'
    ) {
      return;
    }

    router.push('/orgs/local/projects/local');
  }, [isPlatform, router]);

  if (isPlatform && isLoading) {
    return (
      <BaseLayout className="h-full" {...props}>
        <Header className="flex max-h-[59px] flex-auto" />
      </BaseLayout>
    );
  }

  if (!isPlatform && !isHealthy) {
    return (
      <BaseLayout className="h-full" {...props}>
        <Header className="flex max-h-[59px] flex-auto" />

        <Container
          rootClassName="h-full"
          className="grid justify-center max-w-md grid-flow-row gap-2 my-12 text-center"
        >
          <div className="mx-auto">
            <Image
              src="/terminal-text.svg"
              alt="Terminal with a green dot"
              width={72}
              height={72}
            />
          </div>

          <Text variant="h3" component="h1">
            Error Connecting
          </Text>

          <Text>
            Did you forget to start{' '}
            <HighlightedText className="font-mono">nhost up</HighlightedText>?
            Please refer to the{' '}
            <Link
              href="https://docs.nhost.io/platform/cli"
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
            >
              CLI documentation
            </Link>{' '}
            if you are having trouble starting your project.
          </Text>

          <ActivityIndicator label="Checking status..." className="mx-auto" />
        </Container>
      </BaseLayout>
    );
  }

  return (
    <BaseLayout className="flex flex-col h-full" {...props}>
      <Header className="flex py-1" />

      <div
        className="relative flex flex-row h-full overflow-x-hidden"
        ref={setMainNavContainer}
      >
        {mainNavPinned && isMdOrLarger && <PinnedMainNav />}

        <div className="relative flex flex-row w-full h-full bg-accent">
          {(!mainNavPinned || !isMdOrLarger) && (
            <div className="flex justify-center w-6 h-full">
              <MainNav container={mainNavContainer} />
            </div>
          )}

          <RetryableErrorBoundary
            errorMessageProps={{
              className: 'flex flex-col items-center',
            }}
          >
            <div className="flex flex-col w-full h-full">
              <OrgStatus />
              {children}
            </div>
          </RetryableErrorBoundary>

          <InviteNotification />
        </div>
      </div>
    </BaseLayout>
  );
}
