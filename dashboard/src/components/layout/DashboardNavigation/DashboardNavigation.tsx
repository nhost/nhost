import OrganizationNavigation from '@/components/layout/DashboardNavigation/OrganizationNavigation';
import ProjectNavigation, {
  ProjectNavigationFooter,
} from '@/components/layout/DashboardNavigation/ProjectNavigation';
import { useCurrentRoute } from '@/components/layout/DashboardNavigation/useCurrentRoute';
import { NavigationList } from '@/components/layout/NavigationList';

/**
 * The dashboard's navigation for the current route. Hosts decide how to
 * frame it: `AppLayout` docks it in a `DashboardSidebar`, the header opens it
 * in a `DashboardNavigationSheet` on small screens.
 */
export default function DashboardNavigation() {
  const { isProjectRoute } = useCurrentRoute();

  return (
    <NavigationList
      ariaLabel={
        isProjectRoute ? 'Project navigation' : 'Organization navigation'
      }
      footer={isProjectRoute && <ProjectNavigationFooter />}
    >
      {isProjectRoute ? <ProjectNavigation /> : <OrganizationNavigation />}
    </NavigationList>
  );
}
