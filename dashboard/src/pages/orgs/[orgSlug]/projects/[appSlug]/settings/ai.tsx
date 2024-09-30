import { OrgProjectLayout } from '@/components/layout/OrgProjectLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import type { ReactElement } from 'react';

export default function SettingsAI() {
  return (
    <RetryableErrorBoundary>
      <span>AI</span>
    </RetryableErrorBoundary>
  );
}

SettingsAI.getLayout = function getLayout(page: ReactElement) {
  return <OrgProjectLayout>{page}</OrgProjectLayout>;
};
