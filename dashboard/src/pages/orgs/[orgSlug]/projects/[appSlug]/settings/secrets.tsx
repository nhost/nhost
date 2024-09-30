import { OrgProjectLayout } from '@/components/layout/OrgProjectLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import type { ReactElement } from 'react';

export default function SettingsSecrets() {
  return (
    <RetryableErrorBoundary>
      <span>Secrets</span>
    </RetryableErrorBoundary>
  );
}

SettingsSecrets.getLayout = function getLayout(page: ReactElement) {
  return <OrgProjectLayout>{page}</OrgProjectLayout>;
};
