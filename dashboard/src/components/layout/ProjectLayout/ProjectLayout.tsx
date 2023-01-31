import DesktopNav from '@/components/common/DesktopNav';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import type { AuthenticatedLayoutProps } from '@/components/layout/AuthenticatedLayout';
import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout';
import useIsPlatform from '@/hooks/common/useIsPlatform';
import useProjectRoutes from '@/hooks/common/useProjectRoutes';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { useGetAllUserWorkspacesAndApplications } from '@/hooks/useGetAllUserWorkspacesAndApplications';
import { useNavigationVisible } from '@/hooks/useNavigationVisible';
import useNotFoundRedirect from '@/hooks/useNotFoundRedirect';
import { useSetAppWorkspaceContextFromUserContext } from '@/hooks/useSetAppWorkspaceContextFromUserContext';
import type { BoxProps } from '@/ui/v2/Box';
import Box from '@/ui/v2/Box';
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
  const { currentApplication, currentWorkspace } =
    useCurrentWorkspaceAndApplication();

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

  useGetAllUserWorkspacesAndApplications(false);
  useSetAppWorkspaceContextFromUserContext();
  useNotFoundRedirect();

  useEffect(() => {
    if (isPlatform || !router.isReady) {
      return;
    }

    if (isRestrictedPath) {
      router.push('/local/local');
    }
  }, [isPlatform, isRestrictedPath, router]);

  if (!currentWorkspace || !currentApplication || isRestrictedPath) {
    return <LoadingScreen />;
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

        <NextSeo title={currentApplication.name} />
      </Box>
    </>
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
