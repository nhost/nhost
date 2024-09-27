import { OrgProjectLayout } from '@/components/layout/OrgProjectLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import type { ReactElement } from 'react';

export default function DatabasePage() {
  return (
    <RetryableErrorBoundary>
      <span>Database</span>
    </RetryableErrorBoundary>
  );
}

DatabasePage.getLayout = function getLayout(page: ReactElement) {
  return <OrgProjectLayout>{page}</OrgProjectLayout>;
};
