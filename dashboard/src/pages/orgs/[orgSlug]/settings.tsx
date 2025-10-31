import { DeleteOrg } from '@/features/orgs/components/general/components/DeleteOrg';
import { GeneralSettings } from '@/features/orgs/components/general/components/GeneralSettings';
import { Soc2Download } from '@/features/orgs/components/general/components/Soc2Download';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import type { ReactElement } from 'react';

export default function OrgSettings() {
  return (
    <div className="bg-accent-background flex h-full flex-col gap-4 overflow-auto p-4">
      <GeneralSettings />
      <Soc2Download />
      <DeleteOrg />
    </div>
  );
}

OrgSettings.getLayout = function getLayout(page: ReactElement) {
  return <OrgLayout isOrgPage>{page}</OrgLayout>;
};
