import { useRouter } from 'next/router';
import { type ReactElement, useEffect } from 'react';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { NativeQueriesBrowserSidebar } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesBrowserSidebar';

export default function NativeQueriesLandingPage() {
  const router = useRouter();
  const { orgSlug, appSubdomain } = router.query;

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    void router
      .replace(
        `/orgs/${orgSlug}/projects/${appSubdomain}/database/native-queries/default`,
      )
      .catch(console.error);
  }, [router, orgSlug, appSubdomain]);

  return <LoadingScreen />;
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
