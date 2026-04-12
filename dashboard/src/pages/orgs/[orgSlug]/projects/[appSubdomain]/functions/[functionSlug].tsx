import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { FunctionsBrowserSidebar } from '@/features/orgs/projects/serverless-functions/components/FunctionsBrowserSidebar';
import { ServerlessFunctionView } from '@/features/orgs/projects/serverless-functions/components/ServerlessFunctionView';

export default function FunctionDetailsPage() {
  const router = useRouter();
  const { functionSlug } = router.query;

  return (
    <RetryableErrorBoundary>
      <ServerlessFunctionView key={functionSlug as string} />
    </RetryableErrorBoundary>
  );
}

FunctionDetailsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <OrgLayout
      mainContainerProps={{
        className: 'flex h-full',
      }}
    >
      <FunctionsBrowserSidebar />

      <div className="box flex w-full flex-auto flex-col overflow-x-hidden">
        {page}
      </div>
    </OrgLayout>
  );
};
