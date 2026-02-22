import GlobalStyles from '@mui/material/GlobalStyles';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import type { BaseLayoutProps } from '@/components/layout/BaseLayout';
import { BaseLayout } from '@/components/layout/BaseLayout';
import { Container } from '@/components/layout/Container';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Box } from '@/components/ui/v2/Box';
import { ThemeProvider } from '@/components/ui/v2/ThemeProvider';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useAuth } from '@/providers/Auth';

export interface UnauthenticatedLayoutProps extends BaseLayoutProps {
  rightColumnContent?: React.ReactNode;
}

export default function UnauthenticatedLayout({
  children,
  rightColumnContent,
  ...props
}: UnauthenticatedLayoutProps) {
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const { isAuthenticated, isLoading } = useAuth();
  const isOnResetPassword = router.route === '/password/reset';

  useEffect(() => {
    if (!isPlatform || (!isLoading && isAuthenticated)) {
      // we do not want to redirect if the user tries to reset their password
      if (!isOnResetPassword) {
        const redirectQuery =
          typeof router.query.redirect === 'string' &&
          router.query.redirect.startsWith('/')
            ? router.query.redirect
            : null;
        const storedRedirect = sessionStorage.getItem('postSignInRedirect');
        const redirectTarget =
          redirectQuery ||
          (storedRedirect?.startsWith('/') ? storedRedirect : null) ||
          '/';

        if (storedRedirect) {
          sessionStorage.removeItem('postSignInRedirect');
        }

        router.push(redirectTarget);
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
              className="grid h-full w-full items-center justify-items-center gap-12 bg-transparent pt-8 pb-12 lg:grid-cols-2 lg:gap-4 lg:pt-8 lg:pb-0"
            >
              <div className="relative z-10 order-2 grid w-full max-w-[544px] grid-flow-row gap-12 lg:order-1">
                {children}
              </div>

              <div className="relative z-0 order-1 flex h-full w-full flex-col items-center justify-center md:min-h-[150px] lg:order-2 lg:min-h-[none] lg:gap-8">
                <div className="relative flex items-center justify-center">
                  <div className="absolute top-0 right-0 bottom-0 left-0 mx-auto flex h-full w-full max-w-xl items-center justify-center overflow-hidden opacity-70">
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
                    className="backface-hidden absolute right-0 left-0 z-0 mx-auto h-20 w-20 transform-gpu rounded-full opacity-80 blur-[56px]"
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

                {rightColumnContent && (
                  <div className="relative z-10 w-full max-w-md px-4 lg:px-0">
                    {rightColumnContent}
                  </div>
                )}
              </div>
            </Container>
          </Box>
        </RetryableErrorBoundary>
      </BaseLayout>
    </ThemeProvider>
  );
}
