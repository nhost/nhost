import {
  CogIcon,
  CreditCardIcon,
  LayoutGridIcon,
  UsersIcon,
} from 'lucide-react';
import { NavigationList } from '@/components/layout/NavigationList';

const iconClassName = 'size-4';

export default function OrganizationNavigation() {
  return (
    <NavigationList.Section>
      <NavigationList.Item
        label="Projects"
        from="/orgs/$orgSlug"
        to="/orgs/$orgSlug/projects"
        params
        icon={<LayoutGridIcon className={iconClassName} />}
      />
      <NavigationList.Item
        label="General"
        from="/orgs/$orgSlug"
        to="/orgs/$orgSlug/settings"
        params
        icon={<CogIcon className={iconClassName} />}
      />
      <NavigationList.Item
        label="Members"
        from="/orgs/$orgSlug"
        to="/orgs/$orgSlug/members"
        params
        icon={<UsersIcon className={iconClassName} />}
      />
      <NavigationList.Item
        label="Billing"
        from="/orgs/$orgSlug"
        to="/orgs/$orgSlug/billing"
        params
        icon={<CreditCardIcon className={iconClassName} />}
      />
    </NavigationList.Section>
  );
}
