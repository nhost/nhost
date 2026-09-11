import type { ReactElement } from 'react';
import { DeleteOrg } from '@/features/orgs/components/general/components/DeleteOrg';
import { GeneralSettings } from '@/features/orgs/components/general/components/GeneralSettings';
import { Soc2Download } from '@/features/orgs/components/general/components/Soc2Download';
import { OrganizationLayout } from '@/features/orgs/layout/OrganizationLayout';

export default function OrgSettings() {
  return (
    <div className="flex h-full flex-col overflow-auto bg-accent-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 pb-16 pt-8">
        <h1 className="text-2xl font-semibold">General</h1>
        <GeneralSettings />
        <Soc2Download />
        <DeleteOrg />
      </div>
    </div>
  );
}

OrgSettings.getLayout = function getLayout(page: ReactElement) {
  return <OrganizationLayout>{page}</OrganizationLayout>;
};
