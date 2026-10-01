import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import { ProjectStateGate } from '@/features/orgs/guards/ProjectStateGate';
import { FunctionsBrowserSidebar } from '@/features/orgs/projects/serverless-functions/components/FunctionsBrowserSidebar';
import { ServerlessFunctionView } from '@/features/orgs/projects/serverless-functions/components/ServerlessFunctionView';

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
  return (
    <AppLayout>
      <ProjectScope>
        <ProjectStateGate>
          <div className="flex h-full">
            <FunctionsBrowserSidebar />
            <div className="box flex w-full flex-auto flex-col overflow-x-hidden">
              {page}
            </div>
          </div>
        </ProjectStateGate>
      </ProjectScope>
    </AppLayout>
  );
};
