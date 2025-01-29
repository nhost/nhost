import { SelectOrg } from '@/components/common/SelectOrg';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import {} from '@/utils/__generated__/graphql';
import type { ReactElement } from 'react';

export default function SelectOrganization() {
  return <SelectOrg />;
}

SelectOrganization.getLayout = function getLayout(page: ReactElement) {
  return (
    <AuthenticatedLayout title="Select an Organization">
      {page}
    </AuthenticatedLayout>
  );
};
