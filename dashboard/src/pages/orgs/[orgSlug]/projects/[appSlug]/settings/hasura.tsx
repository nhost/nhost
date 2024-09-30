import { OrgProjectLayout } from '@/components/layout/OrgProjectLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import type { ReactElement } from 'react';

export default function SettingsHasura() {
  return (
    <RetryableErrorBoundary>
      <span>Hasura</span>
    </RetryableErrorBoundary>
  );
}

SettingsHasura.getLayout = function getLayout(page: ReactElement) {
  return <OrgProjectLayout>{page}</OrgProjectLayout>;
};
