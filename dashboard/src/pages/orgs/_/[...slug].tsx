import type { ReactElement } from 'react';
import { SelectOrg } from '@/components/common/SelectOrg';
import { StandaloneLayout } from '@/components/layout/StandaloneLayout';
import { AuthGuard } from '@/features/orgs/layout/AuthGuard';

export default function SelectOrganization() {
  return <SelectOrg />;
}

SelectOrganization.getLayout = function getLayout(page: ReactElement) {
  return (
    <StandaloneLayout title="Select an Organization">
      <AuthGuard>{page}</AuthGuard>
    </StandaloneLayout>
  );
};
