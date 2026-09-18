import type { ReactElement } from 'react';
import { DeleteOrg } from '@/features/orgs/components/general/components/DeleteOrg';
import { GeneralSettings } from '@/features/orgs/components/general/components/GeneralSettings';
import { Soc2Download } from '@/features/orgs/components/general/components/Soc2Download';
import { OrganizationLayout } from '@/features/orgs/layout/OrganizationLayout';

export default function OrgSettings() {
  return (
    <div className="flex h-full flex-col overflow-auto bg-accent-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col px-5 pb-16 pt-8">
        <h1 className="mb-6 font-semibold text-3xl">General</h1>

        {/* Same card-to-card rhythm as the Project Settings general tab
            (gap-8), kept separate from the header spacing (h1's own
            mb-6) rather than one shared gap value for everything. */}
        <div className="grid grid-flow-row gap-8">
          <GeneralSettings />
          <Soc2Download />
          <DeleteOrg />
        </div>
      </div>
    </div>
  );
}

OrgSettings.getLayout = function getLayout(page: ReactElement) {
  return <OrganizationLayout>{page}</OrganizationLayout>;
};
