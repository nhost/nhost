import { OrgProjectLayout } from '@/components/layout/OrgProjectLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import type { ReactElement } from 'react';

export default function DeploymentsPage() {
  return (
    <RetryableErrorBoundary>
      <span>Deployments</span>
    </RetryableErrorBoundary>
  );
}

DeploymentsPage.getLayout = function getLayout(page: ReactElement) {
  return <OrgProjectLayout>{page}</OrgProjectLayout>;
};
