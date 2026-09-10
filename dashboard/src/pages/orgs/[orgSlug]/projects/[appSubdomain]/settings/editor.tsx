import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProjectViewWithState } from '@/features/orgs/layout/ProjectGuard';
import { ProjectScope } from '@/features/orgs/layout/ProjectScope';
import { TOMLEditor } from '@/features/orgs/projects/common/components/settings/TOMLEditor';

export default function TOMLEditorPage() {
  return <TOMLEditor />;
}

TOMLEditorPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <ProjectViewWithState>
          <div className="flex flex-col h-full overflow-auto">{page}</div>
        </ProjectViewWithState>
      </ProjectScope>
    </AppLayout>
  );
};
