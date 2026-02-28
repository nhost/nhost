import Link from 'next/link';
import { InfoAlert } from '@/features/orgs/components/InfoAlert';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

function PiTRNotEnabled() {
  const { org } = useCurrentOrg();
  const { project } = useProject();
  return (
    <InfoAlert>
      To enable Point-in-Time recovery, enable it in the{' '}
      <Link
        href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/database`}
        className="text-[#0052cd] text-[0.9375rem] leading-[1.375rem] hover:underline dark:text-[#3888ff]"
        target="_blank"
        rel="noopener noreferrer"
      >
        database settings.
      </Link>
    </InfoAlert>
  );
}

export default PiTRNotEnabled;
