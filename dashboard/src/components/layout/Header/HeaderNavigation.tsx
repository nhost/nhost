import { useRouter } from 'next/router';
import AccountBreadcrumb from '@/components/layout/Header/AccountBreadcrumb';
import OrganizationsCombobox from '@/components/layout/Header/OrganizationsCombobox';
import ProjectsComboBox from '@/components/layout/Header/ProjectsComboBox';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';

export default function HeaderNavigation() {
  const isPlatform = useIsPlatform();
  const { query, pathname } = useRouter();
  const { appSubdomain } = query;

  if (!isPlatform) {
    return null;
  }

  return (
    <nav
      aria-label="Header navigation"
      className="flex min-w-0 flex-row flex-nowrap items-center overflow-x-auto"
    >
      <div className="flex flex-nowrap items-center gap-1">
        {/* The account settings page belongs to no organization, so it
            shows where you came from instead of an empty org picker. */}
        {pathname === '/account' ? (
          <AccountBreadcrumb />
        ) : (
          <>
            <OrganizationsCombobox />
            {appSubdomain && <ProjectsComboBox />}
          </>
        )}
      </div>
    </nav>
  );
}
