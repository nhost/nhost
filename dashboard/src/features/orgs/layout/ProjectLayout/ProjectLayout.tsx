import type { AuthenticatedLayoutProps } from '@/components/layout/AuthenticatedLayout';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { ApplicationErrored } from '@/features/orgs/projects/common/components/ApplicationErrored';
import { ApplicationPaused } from '@/features/orgs/projects/common/components/ApplicationPaused';
import { ApplicationProvisioning } from '@/features/orgs/projects/common/components/ApplicationProvisioning';
import { ApplicationRestoring } from '@/features/orgs/projects/common/components/ApplicationRestoring';
import { ApplicationUnknown } from '@/features/orgs/projects/common/components/ApplicationUnknown';
import { ApplicationUnpausing } from '@/features/orgs/projects/common/components/ApplicationUnpausing';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { ApplicationStatus } from '@/types/application';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { useMemo } from 'react';
import { twMerge } from 'tailwind-merge';

export interface ProjectLayoutProps extends AuthenticatedLayoutProps {
  /**
   * Props passed to the internal `<main />` element.
   */
  mainContainerProps?: BoxProps;
}

function ProjectLayoutContent({
  children,
  mainContainerProps = {},
}: ProjectLayoutProps) {
  const {
    query: { appSlug },
  } = useRouter();

  const isPlatform = useIsPlatform();
  const { state } = useAppState();
  const { project, loading, error } = useProject({ poll: true });

  // Render application state based on the current state
  const projectPageContent = useMemo(() => {
    if (!appSlug || state === undefined) {
      return children;
    }

    switch (state) {
      case ApplicationStatus.Empty:
      case ApplicationStatus.Provisioning:
        return <ApplicationProvisioning />;
      case ApplicationStatus.Errored:
        return <ApplicationErrored />;
      case ApplicationStatus.Pausing:
      case ApplicationStatus.Paused:
        return <ApplicationPaused />;
      case ApplicationStatus.Unpausing:
        return <ApplicationUnpausing />;
      case ApplicationStatus.Restoring:
        return <ApplicationRestoring />;
      case ApplicationStatus.Updating:
      case ApplicationStatus.Live:
      case ApplicationStatus.Migrating:
        return children;
      default:
        return <ApplicationUnknown />;
    }
  }, [state, children, appSlug]);

  // Handle loading state
  if (loading) {
    return <LoadingScreen />;
  }

  // Handle error state
  if (error) {
    throw error;
  }

  return (
    <Box
      component="main"
      className={twMerge(
        'relative h-full flex-auto overflow-y-auto',
        mainContainerProps.className,
      )}
      {...mainContainerProps}
    >
      {projectPageContent}
      <NextSeo title={!isPlatform ? 'Local App' : project?.name} />
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
