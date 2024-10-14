import type { AuthenticatedLayoutProps } from '@/components/layout/AuthenticatedLayout';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { Alert } from '@/components/ui/v2/Alert';
import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { NextSeo } from 'next-seo';
// import { useRouter } from 'next/router';
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
  const { project, loading, error } = useProject();

  // const router = useRouter();
  // const shouldDisplayNav = useNavigationVisible();
  const isPlatform = useIsPlatform();

  // const pathWithoutWorkspaceAndProject = router.asPath.replace(
  //   /^\/[\w\-_[\]]+\/[\w\-_[\]]+/i,
  //   '',
  // );

  // const isRestrictedPath =
  //   !isPlatform &&
  //   nhostRoutes.some((route) =>
  //     pathWithoutWorkspaceAndProject.startsWith(
  //       route.relativeMainPath || route.relativePath,
  //     ),
  //   );

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

  // if (isRestrictedPath || loading) {
  //   return <LoadingScreen />;
  // }

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    throw error;
  }

  if (!isPlatform) {
    return (
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
    );
  }

  return (
    <Box
      component="main"
      className={twMerge(
        'relative flex-auto overflow-y-auto',
        mainContainerClassName,
      )}
      {...mainContainerProps}
    >
      {children}

      <NextSeo title={project?.name} />
    </Box>
  );
}

export default function ProjectLayout({
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
