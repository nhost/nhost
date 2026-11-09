import NextLink from 'next/link';
import { Fragment } from 'react';
import { Button } from '@/components/ui/v3/button';
import { Separator } from '@/components/ui/v3/separator';
import {
  ACCOUNT_SETTINGS_GROUPS,
  ACCOUNT_SETTINGS_TABS,
  getAccountSettingsHref,
} from '@/features/account/settings/accountSettingsTabs';

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
  return (
    <>
      {ACCOUNT_SETTINGS_GROUPS.map(({ label, tabs }, index) => (
        <Fragment key={label}>
          {index > 0 && <Separator />}
          <div className="grid grid-flow-row gap-1 p-2">
            {tabs.map((tab) => {
              const { title, icon: Icon } = ACCOUNT_SETTINGS_TABS[tab];

              return (
                <Button key={tab} asChild variant="menu">
                  <NextLink
                    href={getAccountSettingsHref(tab)}
                    onClick={onNavigate}
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
