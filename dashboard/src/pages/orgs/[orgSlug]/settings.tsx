import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { DefaultOrganizationSettings } from '@/features/orgs/components/general/components/DefaultOrganizationSettings';
import { DeleteOrg } from '@/features/orgs/components/general/components/DeleteOrg';
import { GeneralSettings } from '@/features/orgs/components/general/components/GeneralSettings';
import { Soc2Download } from '@/features/orgs/components/general/components/Soc2Download';
import { OrganizationScope } from '@/features/orgs/guards/OrganizationScope';

export default function OrgSettings() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-8">
      <h1 className="font-semibold text-2.5xl">General</h1>
      <GeneralSettings />
      <DefaultOrganizationSettings />
      <Soc2Download />
      <DeleteOrg />
    </div>
  );
}

OrgSettings.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <OrganizationScope>{page}</OrganizationScope>
    </AppLayout>
  );
};
