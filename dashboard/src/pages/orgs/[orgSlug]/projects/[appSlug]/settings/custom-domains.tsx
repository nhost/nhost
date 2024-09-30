import { OrgProjectLayout } from '@/components/layout/OrgProjectLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import type { ReactElement } from 'react';

export default function SettingsCustomDomains() {
  return (
    <RetryableErrorBoundary>
      <span>Custom Domains</span>
    </RetryableErrorBoundary>
  );
}

SettingsCustomDomains.getLayout = function getLayout(page: ReactElement) {
  return <OrgProjectLayout>{page}</OrgProjectLayout>;
};
