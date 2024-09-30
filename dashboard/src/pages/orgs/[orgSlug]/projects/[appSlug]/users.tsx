import { OrgProjectLayout } from '@/components/layout/OrgProjectLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import type { ReactElement } from 'react';

export default function UsersPage() {
  return (
    <RetryableErrorBoundary>
      <span>Auth/Users</span>
    </RetryableErrorBoundary>
  );
}

UsersPage.getLayout = function getLayout(page: ReactElement) {
  return <OrgProjectLayout>{page}</OrgProjectLayout>;
};
