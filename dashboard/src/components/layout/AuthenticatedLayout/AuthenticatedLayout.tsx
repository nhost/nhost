import Header from '@/components/common/Header';
import HighlightedText from '@/components/common/HighlightedText';
import RetryableErrorBoundary from '@/components/common/RetryableErrorBoundary';
import { InviteAnnounce } from '@/components/home/InviteAnnounce';
import type { BaseLayoutProps } from '@/components/layout/BaseLayout';
import BaseLayout from '@/components/layout/BaseLayout';
import Container from '@/components/layout/Container';
import useIsHealthy from '@/hooks/common/useIsHealthy';
import useIsPlatform from '@/hooks/common/useIsPlatform';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Link from '@/ui/v2/Link';
import Text from '@/ui/v2/Text';
import { useAuthenticationStatus } from '@nhost/nextjs';
import Image from 'next/image';
import { useRouter } from 'next/router';
import type { DetailedHTMLProps, HTMLProps } from 'react';
import { useEffect } from 'react';
import { twMerge } from 'tailwind-merge';

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

  useEffect(() => {
    if (!isPlatform || isLoading || isAuthenticated) {
      return;
    }

    if (router.pathname === '/') {
      router.push('/signup');

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
      <Header className="flex max-h-[59px] flex-auto" />

      <InviteAnnounce />

      <RetryableErrorBoundary errorMessageProps={{ className: 'pt-20' }}>
        <div
          className={twMerge(
            'relative flex flex-auto overflow-x-hidden',
            contentContainerClassName,
          )}
          {...contentContainerProps}
        >
          {children}
        </div>
      </RetryableErrorBoundary>
    </BaseLayout>
  );
}
