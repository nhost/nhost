import { OrgProjectLayout } from '@/components/layout/OrgProjectLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import type { ReactElement } from 'react';

export default function SettingsSMTP() {
  return (
    <RetryableErrorBoundary>
      <span>SMTP</span>
    </RetryableErrorBoundary>
  );
}

SettingsSMTP.getLayout = function getLayout(page: ReactElement) {
  return <OrgProjectLayout>{page}</OrgProjectLayout>;
};
