import { OrgProjectLayout } from '@/components/layout/OrgProjectLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import type { ReactElement } from 'react';

export default function SettingsSignInMethods() {
  return (
    <RetryableErrorBoundary>
      <span>SignIn Methods</span>
    </RetryableErrorBoundary>
  );
}

SettingsSignInMethods.getLayout = function getLayout(page: ReactElement) {
  return <OrgProjectLayout>{page}</OrgProjectLayout>;
};
