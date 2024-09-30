import { OrgProjectLayout } from '@/components/layout/OrgProjectLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import type { ReactElement } from 'react';

export default function SettingsDatabase() {
  return (
    <RetryableErrorBoundary>
      <span>Database</span>
    </RetryableErrorBoundary>
  );
}

SettingsDatabase.getLayout = function getLayout(page: ReactElement) {
  return <OrgProjectLayout>{page}</OrgProjectLayout>;
};
