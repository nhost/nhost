import type { ReactElement } from 'react';
import { SelectOrgAndProject } from '@/components/common/SelectOrgAndProject';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';

export default function OrganizationAndProject() {
  return <SelectOrgAndProject />;
}

OrganizationAndProject.getLayout = function getLayout(page: ReactElement) {
  return (
    <AuthenticatedLayout title="Select a Project">{page}</AuthenticatedLayout>
  );
};
