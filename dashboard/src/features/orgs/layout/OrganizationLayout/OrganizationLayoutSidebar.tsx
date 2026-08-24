import {
  CogIcon,
  CreditCardIcon,
  LayoutGridIcon,
  UsersIcon,
} from 'lucide-react';
import { useRouter } from 'next/router';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

const iconClassName = 'size-4';

export default function OrganizationLayoutSidebar() {
  const router = useRouter();
  const currentPath = router.asPath.split(/[?#]/)[0];
  const [, , orgSlugFromPath] = currentPath.split('/');
  const orgSlug = getSingleQueryParam(router.query.orgSlug) ?? orgSlugFromPath;
  const orgBaseHref = `/orgs/${orgSlug}`;

  return (
    <DashboardSidebar
      ariaLabel="Organization navigation"
      storageKey="organization-sidebar-collapsed"
    >
      <DashboardSidebar.Section>
        <DashboardSidebar.Item
          label="Projects"
          href={`${orgBaseHref}/projects`}
          icon={<LayoutGridIcon className={iconClassName} />}
          active={
            currentPath === `${orgBaseHref}/projects` ||
            currentPath === `${orgBaseHref}/projects/new`
          }
        />
        <DashboardSidebar.Item
          label="General"
          href={`${orgBaseHref}/settings`}
          icon={<CogIcon className={iconClassName} />}
          active={currentPath === `${orgBaseHref}/settings`}
        />
        <DashboardSidebar.Item
          label="Members"
          href={`${orgBaseHref}/members`}
          icon={<UsersIcon className={iconClassName} />}
          active={currentPath === `${orgBaseHref}/members`}
        />
        <DashboardSidebar.Item
          label="Billing"
          href={`${orgBaseHref}/billing`}
          icon={<CreditCardIcon className={iconClassName} />}
          active={currentPath === `${orgBaseHref}/billing`}
        />
      </DashboardSidebar.Section>
    </DashboardSidebar>
  );
}
