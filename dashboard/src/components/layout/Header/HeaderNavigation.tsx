import { useRouter } from 'next/router';
import OrgsComboBox from '@/components/layout/Header/OrgsComboBox';
import ProjectsComboBox from '@/components/layout/Header/ProjectsComboBox';

export default function HeaderNavigation() {
  const { query } = useRouter();
  const { appSubdomain } = query;

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
