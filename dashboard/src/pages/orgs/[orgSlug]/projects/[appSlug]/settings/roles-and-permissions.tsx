import { OrgProjectLayout } from '@/components/layout/OrgProjectLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import type { ReactElement } from 'react';

export default function SettingsRolesAndPermissions() {
  return (
    <RetryableErrorBoundary>
      <span>Roles and permissions</span>
    </RetryableErrorBoundary>
  );
}

SettingsRolesAndPermissions.getLayout = function getLayout(page: ReactElement) {
  return <OrgProjectLayout>{page}</OrgProjectLayout>;
};
