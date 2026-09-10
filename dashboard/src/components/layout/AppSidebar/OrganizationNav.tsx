import {
  CogIcon,
  CreditCardIcon,
  LayoutGridIcon,
  UsersIcon,
} from 'lucide-react';
import { useCurrentRoute } from '@/components/layout/AppSidebar/useCurrentRoute';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';

const iconClassName = 'size-4';

export default function OrganizationNav() {
  const { currentPath, orgSlug } = useCurrentRoute();
  const baseHref = `/orgs/${orgSlug}`;

  return (
    <DashboardSidebar.Section>
      <DashboardSidebar.Item
        label="Projects"
        href={`${baseHref}/projects`}
        icon={<LayoutGridIcon className={iconClassName} />}
        active={
          currentPath === `${baseHref}/projects` ||
          currentPath === `${baseHref}/projects/new`
        }
      />
      <DashboardSidebar.Item
        label="General"
        href={`${baseHref}/settings`}
        icon={<CogIcon className={iconClassName} />}
        active={currentPath === `${baseHref}/settings`}
      />
      <DashboardSidebar.Item
        label="Members"
        href={`${baseHref}/members`}
        icon={<UsersIcon className={iconClassName} />}
        active={currentPath === `${baseHref}/members`}
      />
      <DashboardSidebar.Item
        label="Billing"
        href={`${baseHref}/billing`}
        icon={<CreditCardIcon className={iconClassName} />}
        active={currentPath === `${baseHref}/billing`}
      />
    </DashboardSidebar.Section>
  );
}
