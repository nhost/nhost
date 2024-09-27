import { OrgProjectLayout } from '@/components/layout/OrgProjectLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import type { ReactElement } from 'react';

export default function SettingsRateLimiting() {
  return (
    <RetryableErrorBoundary>
      <span>Rate Limiting</span>
    </RetryableErrorBoundary>
  );
}

SettingsRateLimiting.getLayout = function getLayout(page: ReactElement) {
  return <OrgProjectLayout>{page}</OrgProjectLayout>;
};
