import { InfoAlert } from '@/features/orgs/components/InfoAlert';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { CircleAlert } from 'lucide-react';

function NoOtherProjectsInRegion() {
  const { project } = useProject();
  return (
    <InfoAlert
      title={`There are no other projects within the region: ${project.region.name}`}
      icon={<CircleAlert className="h-[38px] w-[38px]" />}
    >
      Backups may be imported from projects that are in the same region and
      organization.
    </InfoAlert>
  );
}

export default NoOtherProjectsInRegion;
