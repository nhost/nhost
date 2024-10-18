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
import { useIsHealthy } from '@/features/projects/common/hooks/useIsHealthy';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { useAuthenticationStatus } from '@nhost/nextjs';

import Image from 'next/image';
import { useRouter } from 'next/router';
import {
  useEffect,
  useState,
  type DetailedHTMLProps,
  type HTMLProps,
} from 'react';
import { twMerge } from 'tailwind-merge';

import PinnedMainNav from '@/components/layout/MainNav/PinnedMainNav';

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
  contentContainerProps: {
    className: contentContainerClassName,
    ...contentContainerProps
  } = {},
  ...props
}: AuthenticatedLayoutProps) {
  const router = useRouter();
  const isPlatform = useIsPlatform();

  const { isAuthenticated, isLoading } = useAuthenticationStatus();
  const isHealthy = useIsHealthy();
  const [mainNavContainer, setMainNavContainer] = useState(null);
  const { mainNavPinned } = useTreeNavState();

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
      router.query.workspaceSlug === 'local' &&
      router.query.appSlug === 'local'
    ) {
      return;
    }

    router.push('/local/local');
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
        {mainNavPinned && <PinnedMainNav />}

        <div className="relative flex flex-row w-full h-full overflow-auto bg-accent">
          {!mainNavPinned && (
            <div className="flex justify-center w-6 h-full">
              <MainNav container={mainNavContainer} />
            </div>
          )}

          <RetryableErrorBoundary errorMessageProps={{ className: 'pt-20' }}>
            <div
              className={twMerge(
                'relative flex w-full flex-auto overflow-x-hidden',
                contentContainerClassName,
              )}
              {...contentContainerProps}
            >
              {children}
            </div>
          </RetryableErrorBoundary>

          <InviteNotification />
        </div>
      </div>
    </BaseLayout>
  );
}
