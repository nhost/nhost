import {
  CogIcon,
  CreditCardIcon,
  LayoutGridIcon,
  UsersIcon,
} from 'lucide-react';
import { useCurrentRoute } from '@/components/layout/DashboardNavigation/useCurrentRoute';
import { NavigationList } from '@/components/layout/NavigationList';

const iconClassName = 'size-4';

export default function OrganizationNavigation() {
  const { currentPath, orgSlug } = useCurrentRoute();
  const baseHref = `/orgs/${orgSlug}`;

  return (
    <NavigationList.Section>
      <NavigationList.Item
        label="Projects"
        href={`${baseHref}/projects`}
        icon={<LayoutGridIcon className={iconClassName} />}
        active={
          currentPath === `${baseHref}/projects` ||
          currentPath === `${baseHref}/projects/new`
        }
      />
      <NavigationList.Item
        label="General"
        href={`${baseHref}/settings`}
        icon={<CogIcon className={iconClassName} />}
        active={currentPath === `${baseHref}/settings`}
      />
      <NavigationList.Item
        label="Members"
        href={`${baseHref}/members`}
        icon={<UsersIcon className={iconClassName} />}
        active={currentPath === `${baseHref}/members`}
      />
      <NavigationList.Item
        label="Billing"
        href={`${baseHref}/billing`}
        icon={<CreditCardIcon className={iconClassName} />}
        active={currentPath === `${baseHref}/billing`}
      />
    </NavigationList.Section>
  );
}
