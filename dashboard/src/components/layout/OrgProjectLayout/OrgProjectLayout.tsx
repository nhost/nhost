import type { AuthenticatedLayoutProps } from '@/components/layout/AuthenticatedLayout';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { DesktopNav } from '@/components/layout/DesktopNav';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { useNavigationVisible } from '@/features/projects/common/hooks/useNavigationVisible';
import { useProjectRoutes } from '@/features/projects/common/hooks/useProjectRoutes';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { twMerge } from 'tailwind-merge';

export interface ProjectLayoutProps extends AuthenticatedLayoutProps {
  /**
   * Props passed to the internal `<main />` element.
   */
  mainContainerProps?: BoxProps;
}

function ProjectLayoutContent({
  children,
  mainContainerProps: {
    className: mainContainerClassName,
    ...mainContainerProps
  } = {},
}: ProjectLayoutProps) {
  const { currentProject, loading, error } = useCurrentWorkspaceAndProject();

  const router = useRouter();
  const shouldDisplayNav = useNavigationVisible();
  const isPlatform = useIsPlatform();
  const { nhostRoutes } = useProjectRoutes();
  const pathWithoutWorkspaceAndProject = router.asPath.replace(
    /^\/[\w\-_[\]]+\/[\w\-_[\]]+/i,
    '',
  );
  const isRestrictedPath =
    !isPlatform &&
    nhostRoutes.some((route) =>
      pathWithoutWorkspaceAndProject.startsWith(
        route.relativeMainPath || route.relativePath,
      ),
    );

  // useNotFoundRedirect();

  // useEffect(() => {
  //   if (isPlatform || !router.isReady) {
  //     return;
  //   }

  //   TODO // Double check what restricted path means here
  //   if (isRestrictedPath) {
  //     router.push('/local/local');
  //   }
  // }, [isPlatform, isRestrictedPath, router]);

  if (isRestrictedPath || loading) {
    return <LoadingScreen />;
  }

  if (error) {
    throw error;
  }

  if (!isPlatform) {
    return (
      <>
        <DesktopNav className="top-0 hidden w-20 shrink-0 flex-col items-start sm:flex" />

        <Box
          component="main"
          className={twMerge(
            'relative flex-auto overflow-y-auto',
            mainContainerClassName,
          )}
          {...mainContainerProps}
        >
          {children}

          <NextSeo title="Local App" />
        </Box>
      </>
    );
  }

  return (
    <>
      {shouldDisplayNav && (
        <DesktopNav className="top-0 hidden w-20 shrink-0 flex-col items-start sm:flex" />
      )}

      <Box
        component="main"
        className={twMerge(
          'relative flex-auto overflow-y-auto',
          mainContainerClassName,
        )}
        {...mainContainerProps}
      >
        {children}

        <NextSeo title={currentProject?.name} />
      </Box>
    </>
  );
}

export default function OrgProjectLayout({
  children,
  mainContainerProps,
  ...props
}: ProjectLayoutProps) {
  return (
    <AuthenticatedLayout {...props}>
      <ProjectLayoutContent mainContainerProps={mainContainerProps}>
        {children}
      </ProjectLayoutContent>
    </AuthenticatedLayout>
  );
}
