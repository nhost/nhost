import { InviteNotification } from '@/components/common/InviteNotification';
import type { BaseLayoutProps } from '@/components/layout/BaseLayout';
import { BaseLayout } from '@/components/layout/BaseLayout';
import { Container } from '@/components/layout/Container';
import { Header } from '@/components/layout/Header';
import { MainNav } from '@/components/layout/MainNav';
import { HighlightedText } from '@/components/presentational/HighlightedText';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import { useIsHealthy } from '@/features/projects/common/hooks/useIsHealthy';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';
import { useAuthenticationStatus } from '@nhost/nextjs';
import NextLink from 'next/link';

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
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { cn } from '@/lib/utils';

export interface AuthenticatedLayoutProps extends BaseLayoutProps {
  /**
   * Props passed to the internal content container.
   */
  contentContainerProps?: DetailedHTMLProps<
    HTMLProps<HTMLDivElement>,
    HTMLDivElement
  >;
}

// TODO(org)(1) create a main file which exports this to both
// the breadcrumps and here
const orgPages = [
  { label: 'Settings', value: 'settings' },
  { label: 'Projects', value: 'projects' },
  { label: 'Members', value: 'members' },
  { label: 'Billing', value: 'billing' },
];

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
  const { org } = useCurrentOrg();

  const { isAuthenticated, isLoading } = useAuthenticationStatus();
  const isHealthy = useIsHealthy();
  const [mainNavContainer, setMainNavContainer] = useState(null);
  const [mainNavPinned] = useSSRLocalStorage('nav-tree-pin', false);

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

  const showOrgNavigation = !router.query.workspaceSlug && router.route !== '/';

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
          className="my-12 grid max-w-md grid-flow-row justify-center gap-2 text-center"
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
    <BaseLayout className="flex h-full flex-col" {...props}>
      <Header className="flex py-1" />

      <div
        className="relative flex h-full flex-row overflow-x-hidden"
        ref={setMainNavContainer}
      >
        {mainNavPinned && <PinnedMainNav />}

        <div className="flex h-full w-full flex-col overflow-auto">
          <div className="relative flex h-12 w-full flex-shrink-0 flex-row items-center space-x-2 border-b bg-background px-2">
            {!mainNavPinned && <MainNav container={mainNavContainer} />}

            {showOrgNavigation &&
              orgPages.map((page) => {
                const href = `/orgs/${org?.slug}/${page.value}`;
                const isActive = router.asPath === href;
                return (
                  <NextLink
                    key={page.value}
                    passHref
                    href={href}
                    className={cn(
                      'flex h-8 items-center justify-center rounded px-4 text-sm font-medium transition-colors hover:bg-secondary/80',
                      isActive ? 'bg-secondary text-primary-main' : '',
                    )}
                  >
                    {page.label}
                    <span className="sr-only">Home</span>
                  </NextLink>
                );
              })}
          </div>

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
