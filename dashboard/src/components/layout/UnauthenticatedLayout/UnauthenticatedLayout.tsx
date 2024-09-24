import type { BaseLayoutProps } from '@/components/layout/BaseLayout';
import { BaseLayout } from '@/components/layout/BaseLayout';
import { Container } from '@/components/layout/Container';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Box } from '@/components/ui/v2/Box';
import { ThemeProvider } from '@/components/ui/v2/ThemeProvider';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { useGetOrganizationsLazyQuery } from '@/utils/__generated__/graphql';
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

  const [fetchOrgs] = useGetOrganizationsLazyQuery();

  useEffect(() => {
    (async () => {
      if (!isPlatform || (!isLoading && isAuthenticated)) {
        // TODO(orgs) discuss how this should work
        // if we should make a page with all orgs and then the user can select one
        // fetch the orgs
        // then redirect to the first one
        // /org-slug/projects
        try {
          const {
            data: { organizations },
          } = await fetchOrgs();

          const defaultOrg = organizations.at(0);

          router.push(`/orgs/${defaultOrg.slug}/projects`);
        } catch (error) {
          console.log('Error: no orgs after signup');
        }
        // router.push('/');
      }
    })();
  }, [isLoading, isAuthenticated, router, isPlatform, fetchOrgs]);

  if (!isPlatform || isLoading || isAuthenticated) {
    return (
      <BaseLayout {...props}>
        <LoadingScreen
          sx={{ backgroundColor: (theme) => theme.palette.background.default }}
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
