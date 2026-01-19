import type { ReactElement } from 'react';
import { SelectOrg } from '@/components/common/SelectOrg';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';

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
