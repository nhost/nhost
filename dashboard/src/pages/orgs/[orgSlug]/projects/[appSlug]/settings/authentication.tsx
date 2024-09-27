import { OrgProjectLayout } from '@/components/layout/OrgProjectLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import type { ReactElement } from 'react';

export default function SettingsAuthentication() {
  return (
    <RetryableErrorBoundary>
      <span>Authentication</span>
    </RetryableErrorBoundary>
  );
}

SettingsAuthentication.getLayout = function getLayout(page: ReactElement) {
  return <OrgProjectLayout>{page}</OrgProjectLayout>;
};
