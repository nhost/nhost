import { OrgProjectLayout } from '@/components/layout/OrgProjectLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import type { ReactElement } from 'react';

export default function StoragePage() {
  return (
    <RetryableErrorBoundary>
      <span>Storage</span>
    </RetryableErrorBoundary>
  );
}
StoragePage.getLayout = function getLayout(page: ReactElement) {
  return <OrgProjectLayout>{page}</OrgProjectLayout>;
};
