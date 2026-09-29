import type { ReactElement } from 'react';
import { DeleteOrg } from '@/features/orgs/components/general/components/DeleteOrg';
import { GeneralSettings } from '@/features/orgs/components/general/components/GeneralSettings';
import { Soc2Download } from '@/features/orgs/components/general/components/Soc2Download';
import { OrganizationLayout } from '@/features/orgs/layout/OrganizationLayout';

export default function OrgSettings() {
  return (
    <div className="flex h-full flex-col gap-4 overflow-auto bg-accent-background p-4">
      <GeneralSettings />
      <Soc2Download />
      <DeleteOrg />
    </div>
  );
}

OrgSettings.getLayout = function getLayout(page: ReactElement) {
  return <OrganizationLayout>{page}</OrganizationLayout>;
};
