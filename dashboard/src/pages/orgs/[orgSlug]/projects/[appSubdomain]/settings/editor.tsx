import type { ReactElement } from 'react';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { TOMLEditor } from '@/features/orgs/projects/common/components/settings/TOMLEditor';

export default function TOMLEditorPage() {
  return <TOMLEditor />;
}

TOMLEditorPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <OrgLayout
      mainContainerProps={{
        className: 'flex flex-col h-full overflow-auto',
      }}
    >
      {page}
    </OrgLayout>
  );
};
