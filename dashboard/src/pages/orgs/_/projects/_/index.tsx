import { SelectOrgAndProject } from '@/components/common/SelectOrgAndProject';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import {} from '@/utils/__generated__/graphql';
import type { ReactElement } from 'react';

export default function SelectOrganizationAndProject() {
  return <SelectOrgAndProject />;
}

SelectOrganizationAndProject.getLayout = function getLayout(
  page: ReactElement,
) {
  return (
    <AuthenticatedLayout title="Select a Project">{page}</AuthenticatedLayout>
  );
};
