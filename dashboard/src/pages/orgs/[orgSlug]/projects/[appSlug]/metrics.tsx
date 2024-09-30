import { OrgProjectLayout } from '@/components/layout/OrgProjectLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import type { ReactElement } from 'react';

export default function MetricsPage() {
  return (
    <RetryableErrorBoundary>
      <span>Metrics</span>
    </RetryableErrorBoundary>
  );
}

MetricsPage.getLayout = function getLayout(page: ReactElement) {
  return <OrgProjectLayout>{page}</OrgProjectLayout>;
};
