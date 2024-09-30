import { OrgProjectLayout } from '@/components/layout/OrgProjectLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import type { ReactElement } from 'react';

export default function EnvSettings() {
  return (
    <RetryableErrorBoundary>
      <span>Environment Variables</span>
    </RetryableErrorBoundary>
  );
}

EnvSettings.getLayout = function getLayout(page: ReactElement) {
  return <OrgProjectLayout>{page}</OrgProjectLayout>;
};
