import { useRouter } from 'next/router';
import OrgsComboBox from '@/components/layout/Header/OrgsComboBox';
import ProjectsComboBox from '@/components/layout/Header/ProjectsComboBox';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';

export default function HeaderNavigation() {
  const isPlatform = useIsPlatform();
  const { query } = useRouter();
  const { appSubdomain } = query;

  if (!isPlatform) {
    return null;
  }

  return (
    <nav
      aria-label="Header navigation"
      className="mt-2 flex w-full min-w-0 flex-row flex-nowrap items-center overflow-x-auto lg:mt-0"
    >
      <div className="flex flex-nowrap items-center gap-1">
        <OrgsComboBox />
        {appSubdomain && <ProjectsComboBox />}
      </div>
    </nav>
  );
}
