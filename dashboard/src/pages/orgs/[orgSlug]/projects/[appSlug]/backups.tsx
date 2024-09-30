import { OrgProjectLayout } from '@/components/layout/OrgProjectLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import type { ReactElement } from 'react';

export default function BackupsPage() {
  return (
    <RetryableErrorBoundary>
      <span>Backups</span>
    </RetryableErrorBoundary>
  );
}

BackupsPage.getLayout = function getLayout(page: ReactElement) {
  return <OrgProjectLayout>{page}</OrgProjectLayout>;
};
