import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { TOMLEditor } from '@/features/projects/common/components/settings/TOMLEditor';
import type { ReactElement } from 'react';

export default function TOMLEditorPage() {
  return <TOMLEditor />;
}

TOMLEditorPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ProjectLayout
      mainContainerProps={{
        className: 'flex flex-col h-full',
      }}
    >
      {page}
    </ProjectLayout>
  );
};
