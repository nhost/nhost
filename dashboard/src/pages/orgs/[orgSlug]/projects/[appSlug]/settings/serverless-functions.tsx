import { OrgProjectLayout } from '@/components/layout/OrgProjectLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import type { ReactElement } from 'react';

export default function SettingsServerlessFunctions() {
  return (
    <RetryableErrorBoundary>
      <span>Serverless Functions</span>
    </RetryableErrorBoundary>
  );
}

SettingsServerlessFunctions.getLayout = function getLayout(page: ReactElement) {
  return <OrgProjectLayout>{page}</OrgProjectLayout>;
};
