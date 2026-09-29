import type { ReactElement } from 'react';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { TOMLEditor } from '@/features/orgs/projects/common/components/settings/TOMLEditor';

export default function TOMLEditorPage() {
  return <TOMLEditor />;
}

TOMLEditorPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ProjectLayout
      mainContainerProps={{
        className: 'flex flex-col h-full overflow-auto',
      }}
    >
      {page}
    </ProjectLayout>
  );
};
