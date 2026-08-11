import { TextLink } from '@/components/ui/v3/text-link';
import { InfoAlert } from '@/features/orgs/components/InfoAlert';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

function PiTRNotEnabled() {
  const { org } = useCurrentOrg();
  const { project } = useProject();
  return (
    <InfoAlert>
      To enable Point-in-Time recovery, enable it in the{' '}
      <TextLink
        href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/database`}
      >
        database settings.
      </TextLink>
    </InfoAlert>
  );
}

export default PiTRNotEnabled;
