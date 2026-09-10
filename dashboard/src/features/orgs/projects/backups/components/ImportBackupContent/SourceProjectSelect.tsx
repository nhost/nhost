import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { useImportBackupSourceProjectList } from '@/features/orgs/hooks/useImportBackupSourceProjectList';
import { isEmptyValue } from '@/lib/utils';
import NoOtherProjectsInRegion from './NoOtherProjectsInRegion';

interface Props {
  onProjectSelect: (project: { label: string; id: string }) => void;
  projectId?: string;
}

function SourceProjectSelect({ onProjectSelect, projectId }: Props) {
  const { filteredProjects, loading } = useImportBackupSourceProjectList();

  if (!loading && isEmptyValue(filteredProjects)) {
    return <NoOtherProjectsInRegion />;
  }

  function handleChange(value: string) {
    const selectedProject = filteredProjects.find((fp) => fp.id === value)!;

    onProjectSelect(selectedProject);
  }

  return (
    <div className="w-max">
      <p className="pb-1 text-[#21324B] dark:text-[#DFECF5]">Source project</p>
      <Select value={projectId} onValueChange={handleChange} disabled={loading}>
        <SelectTrigger>
          <SelectValue placeholder="Select a project to import backup from" />
        </SelectTrigger>
        <SelectContent>
          {filteredProjects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="pt-1 text-[#9CA7B7] dark:text-[#68717A]">
        Backups can be imported from projects that are in the same organization
        and region.
      </p>
    </div>
  );
}

export default SourceProjectSelect;
