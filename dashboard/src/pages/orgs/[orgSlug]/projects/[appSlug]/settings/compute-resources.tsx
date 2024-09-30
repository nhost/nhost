import { OrgProjectLayout } from '@/components/layout/OrgProjectLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import type { ReactElement } from 'react';

export default function SettingsComputeResources() {
  return (
    <RetryableErrorBoundary>
      <span>Compute Resources</span>
    </RetryableErrorBoundary>
  );
}

SettingsComputeResources.getLayout = function getLayout(page: ReactElement) {
  return <OrgProjectLayout>{page}</OrgProjectLayout>;
};
