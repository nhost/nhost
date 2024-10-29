import { OrgPagesContainer } from '@/components/layout/OrgPagesContainer';
import { DeleteOrg } from '@/features/orgs/components/general/components/DeleteOrg';
import { GeneralSettings } from '@/features/orgs/components/general/components/GeneralSettings';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import type { ReactElement } from 'react';

export default function OrgSettings() {
  return (
    <div className="flex flex-col h-full gap-4 p-4 overflow-auto bg-accent">
      <GeneralSettings />
      <DeleteOrg />
    </div>
  );
}

OrgSettings.getLayout = function getLayout(page: ReactElement) {
  return (
    <ProjectLayout
      mainContainerProps={{
        className: 'bg-accent',
      }}
    >
      <OrgPagesContainer>{page}</OrgPagesContainer>
    </ProjectLayout>
  );
};
