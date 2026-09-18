import type { ReactElement } from 'react';
import { SelectOrgAndProject } from '@/components/common/SelectOrgAndProject';
import { StandaloneLayout } from '@/components/layout/StandaloneLayout';
import { AuthGuard } from '@/features/orgs/layout/AuthGuard';

export default function OrganizationAndProject() {
  return <SelectOrgAndProject />;
}

OrganizationAndProject.getLayout = function getLayout(page: ReactElement) {
  return (
    <StandaloneLayout title="Select a Project">
      <AuthGuard>{page}</AuthGuard>
    </StandaloneLayout>
  );
};
