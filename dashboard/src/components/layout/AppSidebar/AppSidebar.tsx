import { useRouter } from 'next/router';
import OrganizationNav from '@/components/layout/AppSidebar/OrganizationNav';
import ProjectNav, {
  ProjectNavFooter,
} from '@/components/layout/AppSidebar/ProjectNav';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';

/**
 * The route template, not the resolved path: `/orgs/[orgSlug]/projects/new` is
 * an organization page, but its path is shaped like a project named "new".
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
