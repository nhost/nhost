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
  const { orgSlug } = useCurrentRoute();
  const baseHref = `/orgs/${orgSlug}`;

  return (
    <NavigationList.Section>
      <NavigationList.Item
        label="Projects"
        href={`${baseHref}/projects`}
        icon={<LayoutGridIcon className={iconClassName} />}
      />
      <NavigationList.Item
        label="General"
        href={`${baseHref}/settings`}
        icon={<CogIcon className={iconClassName} />}
      />
      <NavigationList.Item
        label="Members"
        href={`${baseHref}/members`}
        icon={<UsersIcon className={iconClassName} />}
      />
      <NavigationList.Item
        label="Billing"
        href={`${baseHref}/billing`}
        icon={<CreditCardIcon className={iconClassName} />}
      />
    </NavigationList.Section>
  );
}
