import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { Fragment } from 'react';
import { Button } from '@/components/ui/v3/button';
import { Separator } from '@/components/ui/v3/separator';
import {
  ACCOUNT_SETTINGS_GROUPS,
  ACCOUNT_SETTINGS_TABS,
  getAccountSettingsHref,
} from '@/features/account/settings/accountSettingsTabs';
import { isLinkActive } from '@/lib/route-navigation';
import { cn } from '@/lib/utils';

interface AccountMenuActionsProps {
  onNavigate?: VoidFunction;
}

/**
 * One link per account settings page, in the same groups as the page menu,
 * split by separators instead of group labels.
 */
export default function AccountMenuActions({
  onNavigate,
}: AccountMenuActionsProps) {
  const router = useRouter();

  return (
    <>
      {ACCOUNT_SETTINGS_GROUPS.map(({ label, tabs }, index) => (
        <Fragment key={label}>
          {index > 0 && <Separator />}
          <div className="grid grid-flow-row gap-1 p-2">
            {tabs.map((tab) => {
              const { title, icon: Icon } = ACCOUNT_SETTINGS_TABS[tab];
              const href = getAccountSettingsHref(tab);
              // The page you are on, with the same look as the active item
              // in the page menu.
              const active = isLinkActive(router, href, true);

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
                    href={href}
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
        </Fragment>
      ))}
    </>
  );
}
