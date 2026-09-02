import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { FunctionsBrowserSidebar } from '@/features/orgs/projects/serverless-functions/components/FunctionsBrowserSidebar';
import { ServerlessFunctionView } from '@/features/orgs/projects/serverless-functions/components/ServerlessFunctionView';
import { getFunctionsLayout } from '@/features/orgs/projects/serverless-functions/layout';

export default function FunctionDetailsPage() {
  const router = useRouter();
  const { functionSlug } = router.query;
  const slug = Array.isArray(functionSlug)
    ? functionSlug.join('/')
    : (functionSlug as string);

  return (
    <RetryableErrorBoundary>
      <ServerlessFunctionView key={slug} />
    </RetryableErrorBoundary>
  );
}

FunctionDetailsPage.getLayout = function getLayout(page: ReactElement) {
  return getFunctionsLayout(page, {
    sidebar: <FunctionsBrowserSidebar />,
    contentClassName: 'box flex w-full flex-auto flex-col overflow-x-hidden',
  });
};
