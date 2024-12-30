import type { BaseLayoutProps } from '@/components/layout/BaseLayout';
import { BaseLayout } from '@/components/layout/BaseLayout';
import { Container } from '@/components/layout/Container';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Box } from '@/components/ui/v2/Box';
import { ThemeProvider } from '@/components/ui/v2/ThemeProvider';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
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
  const isOnResetPassword = router.route === '/password/reset';

  useEffect(() => {
    if (!isPlatform || (!isLoading && isAuthenticated)) {
      // we do not want to redirect if the user tries to reset their password
      if (!isOnResetPassword) {
        router.push('/');
      }
    }
  }, [isLoading, isAuthenticated, router, isPlatform, isOnResetPassword]);

  if ((!isPlatform || isLoading || isAuthenticated) && !isOnResetPassword) {
    return (
      <BaseLayout {...props}>
        <LoadingScreen
          sx={{ backgroundColor: (theme) => theme.palette.background.default }}
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
            className="flex min-h-screen items-center"
            sx={{ backgroundColor: (theme) => theme.palette.common.black }}
          >
            <Container
              rootClassName="bg-transparent h-full"
              className="grid h-full w-full items-center justify-items-center gap-12 bg-transparent pb-12 pt-8 lg:grid-cols-2 lg:gap-4 lg:pb-0 lg:pt-0"
            >
              <div className="relative z-10 order-2 grid w-full max-w-[544px] grid-flow-row gap-12 lg:order-1">
                {children}
              </div>

              <div className="relative z-0 order-1 flex h-full w-full items-center justify-center md:min-h-[150px] lg:order-2 lg:min-h-[none]">
                <div className="absolute bottom-0 left-0 right-0 top-0 mx-auto flex h-full w-full max-w-xl items-center justify-center overflow-hidden opacity-70">
                  <Image
                    priority
                    src="/assets/line-grid.svg"
                    width={1003}
                    height={644}
                    alt="Transparent lines"
                    objectFit="fill"
                    className="h-full w-full scale-[200%]"
                  />
                </div>

                <Box
                  className="backface-hidden absolute left-0 right-0 z-0 mx-auto h-20 w-20 transform-gpu rounded-full opacity-80 blur-[56px]"
                  sx={{
                    backgroundColor: (theme) => theme.palette.primary.main,
                  }}
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
