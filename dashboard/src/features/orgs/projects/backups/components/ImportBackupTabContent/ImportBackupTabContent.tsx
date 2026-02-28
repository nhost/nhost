import { useState } from 'react';
import { TabsContent } from '@/components/ui/v3/tabs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import SourceProjectBackupInfo from './SourceProjectBackupInfo';
import SourceProjectSelect from './SourceProjectSelect';

function ImportBackupContent() {
  const { project } = useProject();
  const [sourceProject, setSourceProject] = useState<{
    label: string;
    id: string;
  }>();

  function handleProjectSelect(selectedProject: { label: string; id: string }) {
    setSourceProject(selectedProject);
  }

  const title = sourceProject
    ? `Import backup from ${sourceProject.label}`
    : '';

  return (
    <TabsContent value="importBackup">
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="mb-4 text-base leading-5">
            <strong>Target project:</strong> {project?.name} (
            {project?.region.name})
          </h1>
          <SourceProjectSelect
            projectId={sourceProject?.id}
            onProjectSelect={handleProjectSelect}
          />
        </div>
        {sourceProject && (
          <SourceProjectBackupInfo appId={sourceProject.id} title={title} />
        )}
      </div>
    </TabsContent>
  );
}

export default ImportBackupContent;
