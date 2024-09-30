import { OrgProjectLayout } from '@/components/layout/OrgProjectLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import type { ReactElement } from 'react';

export default function RunPage() {
  return (
    <RetryableErrorBoundary>
      <span>Run</span>
    </RetryableErrorBoundary>
  );
}

RunPage.getLayout = function getLayout(page: ReactElement) {
  return <OrgProjectLayout>{page}</OrgProjectLayout>;
};
