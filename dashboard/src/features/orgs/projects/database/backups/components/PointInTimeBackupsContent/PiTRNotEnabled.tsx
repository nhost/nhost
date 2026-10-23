import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { TextLink } from '@/components/ui/v3/text-link';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

function PiTRNotEnabled() {
  const { org } = useCurrentOrg();
  const { project } = useProject();
  return (
    <Alert>
      <AlertDescription>
        To enable Point-in-Time recovery, enable it in the{' '}
        <TextLink
          href={`/orgs/${org?.slug}/projects/${project?.subdomain}/database/settings?tab=point-in-time`}
        >
          database settings.
        </TextLink>
      </AlertDescription>
    </Alert>
  );
}

export default PiTRNotEnabled;
