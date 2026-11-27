import { useContext } from 'react';
import OrganizationNavigation from '@/components/layout/DashboardNavigation/OrganizationNavigation';
import ProjectNavigation from '@/components/layout/DashboardNavigation/ProjectNavigation';
import { useCurrentRoute } from '@/components/layout/DashboardNavigation/useCurrentRoute';
import {
  NavigationList,
  NavigationListContext,
} from '@/components/layout/NavigationList';
import { NavigationSearch } from '@/features/command-palette/CommandPaletteProvider';

/**
 * The dashboard's navigation for the current route. Hosts decide how to
 * frame it: `AppLayout` docks it in a `DashboardSidebar`, the header opens it
 * in a `DashboardNavigationSheet` on small screens.
 */
export default function DashboardNavigation({
  onSearch,
}: {
  onSearch?: VoidFunction;
} = {}) {
  const { collapsed } = useContext(NavigationListContext);
  const { isProjectRoute } = useCurrentRoute();

  return (
    <NavigationList
      className="[&_section:first-of-type]:mt-1"
      ariaLabel={
        isProjectRoute ? 'Project navigation' : 'Organization navigation'
      }
    >
      <NavigationSearch collapsed={collapsed} onSelect={onSearch} />
      {isProjectRoute ? <ProjectNavigation /> : <OrganizationNavigation />}
    </NavigationList>
  );
}
