import type { AuthenticatedLayoutProps } from '@/components/layout/AuthenticatedLayout';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { useProjectRoutes } from '@/features/projects/common/hooks/useProjectRoutes';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
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
  const router = useRouter();
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

  // TODO(orgs) 1
  // useNotFoundRedirect();

  useEffect(() => {
    if (isPlatform || !router.isReady) {
      return;
    }

    if (isRestrictedPath) {
      router.push('/local/local');
    }
  }, [isPlatform, isRestrictedPath, router]);

  if (isRestrictedPath || loading) {
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

/**
 * This components wraps the content in an `AuthenticatedLayout` and fetches
 * project and workspace data from the API. Use this layout for pages where
 * project related data is necessary (e.g: Overview, Data Browser, etc.).
 */
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
