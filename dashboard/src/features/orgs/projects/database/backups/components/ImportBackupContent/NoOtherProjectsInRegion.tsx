import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

function NoOtherProjectsInRegion() {
  const { project } = useProject();
  return (
    <Alert>
      <AlertTitle>
        {`There are no other projects within the region: ${project?.region.name}`}
      </AlertTitle>
      <AlertDescription>
        Backups may be imported from projects that are in the same region and
        organization.
      </AlertDescription>
    </Alert>
  );
}

export default NoOtherProjectsInRegion;
