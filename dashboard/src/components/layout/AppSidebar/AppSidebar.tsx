import { useRouter } from 'next/router';
import OrganizationNav from '@/components/layout/AppSidebar/OrganizationNav';
import ProjectNav, {
  ProjectNavFooter,
} from '@/components/layout/AppSidebar/ProjectNav';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';

/**
 * Match Next.js route templates, not actual URLs, to distinguish existing
 * project pages (`[appSubdomain]`) from the create-project page (`new`).
 * The create-project page should show organization navigation.
 */
const PROJECT_ROUTE = '/orgs/[orgSlug]/projects/[appSubdomain]';
const ORGANIZATION_ROUTE = '/orgs/[orgSlug]';

/** The sidebar belongs to every route scoped to an organization. */
export function hasAppSidebar(pathname: string) {
  return pathname.startsWith(ORGANIZATION_ROUTE);
}

export default function AppSidebar() {
  const { pathname } = useRouter();
  const isProjectRoute = pathname.startsWith(PROJECT_ROUTE);

  return (
    <DashboardSidebar
      ariaLabel={
        isProjectRoute ? 'Project navigation' : 'Organization navigation'
      }
      footer={isProjectRoute && <ProjectNavFooter />}
    >
      {isProjectRoute ? <ProjectNav /> : <OrganizationNav />}
    </DashboardSidebar>
  );
}
