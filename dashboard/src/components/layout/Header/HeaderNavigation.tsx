import { useRouter } from 'next/router';
import OrganizationsCombobox from '@/components/layout/Header/OrganizationsCombobox';
import ProjectsComboBox from '@/components/layout/Header/ProjectsComboBox';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';

export default function HeaderNavigation() {
  const isPlatform = useIsPlatform();
  const { query, pathname } = useRouter();
  const { appSubdomain } = query;

  if (!isPlatform || pathname === '/account') {
    return null;
  }

  return (
    <nav
      aria-label="Header navigation"
      className="flex min-w-0 flex-row flex-nowrap items-center overflow-x-auto"
    >
      <div className="flex flex-nowrap items-center gap-1">
        <OrganizationsCombobox />
        {appSubdomain && <ProjectsComboBox />}
      </div>
    </nav>
  );
}
