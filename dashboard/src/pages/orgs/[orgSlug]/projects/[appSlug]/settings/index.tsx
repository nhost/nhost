import { OrgProjectLayout } from '@/components/layout/OrgProjectLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import type { ReactElement } from 'react';

export default function SettingsGeneral() {
  return (
    <RetryableErrorBoundary>
      <span>General</span>
    </RetryableErrorBoundary>
  );
}

SettingsGeneral.getLayout = function getLayout(page: ReactElement) {
  return <OrgProjectLayout>{page}</OrgProjectLayout>;
};
