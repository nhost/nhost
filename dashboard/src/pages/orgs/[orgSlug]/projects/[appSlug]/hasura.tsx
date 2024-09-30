import { OrgProjectLayout } from '@/components/layout/OrgProjectLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import type { ReactElement } from 'react';

export default function HasuraPage() {
  return (
    <RetryableErrorBoundary>
      <span>Hasura</span>
    </RetryableErrorBoundary>
  );
}

HasuraPage.getLayout = function getLayout(page: ReactElement) {
  return <OrgProjectLayout>{page}</OrgProjectLayout>;
};
