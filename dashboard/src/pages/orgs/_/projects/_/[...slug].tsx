import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import {} from '@/utils/__generated__/graphql';
import type { ReactElement } from 'react';

import { SelectOrgAndProject } from '@/components/common/SelectOrgAndProject';

export default function OrganizationAndProject() {
  return <SelectOrgAndProject />;
}

OrganizationAndProject.getLayout = function getLayout(page: ReactElement) {
  return (
    <AuthenticatedLayout title="Select a Project">{page}</AuthenticatedLayout>
  );
};
