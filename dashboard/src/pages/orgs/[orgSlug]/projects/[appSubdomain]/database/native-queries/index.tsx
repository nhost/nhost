import { useRouter } from 'next/router';
import { type ReactElement, useEffect } from 'react';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { NativeQueriesBrowserSidebar } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesBrowserSidebar';
import { NativeQueriesEmptyState } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesEmptyState';
import { useGetSupportedNativeQuerySources } from '@/features/orgs/projects/database/native-queries/hooks/useGetSupportedNativeQuerySources';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function NativeQueriesLandingPage() {
  const router = useRouter();
  const { orgSlug, appSubdomain } = router.query;
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const {
    data: sources = [],
    isLoading,
    error,
  } = useGetSupportedNativeQuerySources();
  const hasDefault = sources.includes('default');

  useEffect(() => {
    if (!router.isReady || isLoading || error || !hasDefault) {
      return;
    }
    void router
      .replace(
        `/orgs/${orgSlug}/projects/${appSubdomain}/database/native-queries/default`,
      )
      .catch(console.error);
  }, [router, orgSlug, appSubdomain, isLoading, error, hasDefault]);

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <NativeQueriesEmptyState
        title="Could not load data sources"
        description="Metadata could not be loaded. Please try again."
      />
    );
  }

  if (!router.isReady || isLoading || hasDefault) {
    return <LoadingScreen />;
  }

  return (
    <NativeQueriesEmptyState
      title={
        sources.length ? 'Select a data source' : 'No supported data sources'
      }
      description={
        sources.length
          ? 'Choose a PostgreSQL data source from the sidebar to browse native queries and logical models.'
          : 'Connect a PostgreSQL data source to use native queries and logical models.'
      }
    />
  );
}

NativeQueriesLandingPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <OrgLayout mainContainerProps={{ className: 'flex h-full' }}>
      <NativeQueriesBrowserSidebar />
      <div className="flex w-full flex-auto flex-col overflow-x-hidden bg-background">
        {page}
      </div>
    </OrgLayout>
  );
};
