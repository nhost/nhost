import { LineGrid } from '@/components/common/LineGrid';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import RetryableErrorBoundary from '@/components/common/RetryableErrorBoundary';
import type { BaseLayoutProps } from '@/components/layout/BaseLayout';
import BaseLayout from '@/components/layout/BaseLayout';
import Container from '@/components/layout/Container';
import useIsPlatform from '@/hooks/common/useIsPlatform';
import { useCleanWorkspaceContext } from '@/hooks/use-cleanWorkspaceContext';
import Box from '@/ui/v2/Box';
import ThemeProvider from '@/ui/v2/ThemeProvider';
import GlobalStyles from '@mui/material/GlobalStyles';
import { useAuthenticationStatus } from '@nhost/nextjs';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export interface UnauthenticatedLayoutProps extends BaseLayoutProps {}

export default function UnauthenticatedLayout({
  children,
  ...props
}: UnauthenticatedLayoutProps) {
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const { isAuthenticated, isLoading } = useAuthenticationStatus();
  useCleanWorkspaceContext();

  useEffect(() => {
    if (!isPlatform || (!isLoading && isAuthenticated)) {
      router.push('/');
    }
  }, [isLoading, isAuthenticated, router, isPlatform]);

  if (!isPlatform || isLoading || isAuthenticated) {
    return (
      <BaseLayout {...props}>
        <LoadingScreen
          sx={{ backgroundColor: '#000 !important' }}
          slotProps={{
            activityIndicator: {
              className: 'text-white',
            },
          }}
        />
      </BaseLayout>
    );
  }

  return (
    <ThemeProvider color="dark">
      <BaseLayout {...props}>
        <GlobalStyles
          styles={{
            'html, body': {
              backgroundColor: `#000 !important`,
            },
            '#__next': {
              overflow: 'auto',
            },
          }}
        />

        <RetryableErrorBoundary>
          <Box
            className="flex min-h-screen items-center py-8"
            sx={{
              backgroundColor: (theme) => theme.palette.common.black,
            }}
          >
            <Container
              rootClassName="bg-transparent h-full py-8"
              className="grid h-full w-full items-center justify-items-center gap-24 bg-transparent lg:grid-cols-2 lg:gap-4"
            >
              <div className="order-2 grid w-full max-w-[544px] grid-flow-row gap-12 lg:order-1">
                {children}
              </div>

              <div className="relative order-1 flex h-full w-full items-center justify-center lg:order-2">
                <LineGrid
                  className="absolute top-0 left-0 right-0 bottom-0 flex h-full w-full items-center justify-center"
                  priority
                  slotProps={{ image: { className: 'scale-[200%]' } }}
                />
                <Image
                  src="/assets/logo.svg"
                  width={119}
                  height={40}
                  alt="Nhost Logo"
                />
              </div>
            </Container>
          </Box>
        </RetryableErrorBoundary>
      </BaseLayout>
    </ThemeProvider>
  );
}
