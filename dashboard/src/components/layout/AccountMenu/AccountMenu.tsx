import { useState } from 'react';
import AccountMenuContent from '@/components/layout/AccountMenu/AccountMenuContent';
import AccountMenuTrigger from '@/components/layout/AccountMenu/AccountMenuTrigger';
import AccountMenuUserInfo from '@/components/layout/AccountMenu/AccountMenuUserInfo';
import { Popover, PopoverContent } from '@/components/ui/v3/popover';

function AccountMenu() {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <AccountMenuTrigger />

      <PopoverContent align="end" className="mt-1 w-full max-w-xs p-0">
        <AccountMenuUserInfo />
        <AccountMenuContent onAccountSettingsClick={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

export default AccountMenu;
