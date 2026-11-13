import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/v3/button';
import {
  ACCOUNT_MENU_LINKS,
  ACCOUNT_SETTINGS_DEFAULT_TAB,
  ACCOUNT_SETTINGS_TABS,
  getAccountSettingsHref,
} from '@/features/account/settings/accountSettingsTabs';
import { cn } from '@/lib/utils';

interface AccountMenuActionsProps {
  onNavigate?: VoidFunction;
}

/**
 * Links into account settings, one per sidebar group: Profile and Security.
 * The one for the page you are on is highlighted, like in the page menu.
 */
export default function AccountMenuActions({
  onNavigate,
}: AccountMenuActionsProps) {
  const router = useRouter();
  const isAccountPage = router.pathname === '/account';
  const currentTab =
    typeof router.query.tab === 'string'
      ? router.query.tab
      : ACCOUNT_SETTINGS_DEFAULT_TAB;

  return (
    <div className="grid grid-flow-row gap-1 p-2">
      {ACCOUNT_MENU_LINKS.map(({ title, tab, activeTabs }) => {
        const { icon: Icon } = ACCOUNT_SETTINGS_TABS[tab];
        const active =
          isAccountPage &&
          activeTabs.some((activeTab) => activeTab === currentTab);

        return (
          <Button
            key={tab}
            asChild
            variant="menu"
            className={cn(
              active &&
                'bg-accent text-primary hover:bg-accent hover:text-primary',
            )}
          >
            <NextLink
              href={getAccountSettingsHref(tab)}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-4 w-4" />
              {title}
            </NextLink>
          </Button>
        );
      })}
    </div>
  );
}
