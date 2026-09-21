import { type ReactNode, type Ref, useState } from 'react';
import AccountMenuContent from '@/components/layout/AccountMenu/AccountMenuContent';
import AccountMenuTrigger from '@/components/layout/AccountMenu/AccountMenuTrigger';
import AccountMenuUserInfo from '@/components/layout/AccountMenu/AccountMenuUserInfo';
import { Popover, PopoverContent } from '@/components/ui/v3/popover';

export interface AccountMenuProps {
  /** Rendered between the user info and the account actions. */
  children?: ReactNode;
  triggerRef?: Ref<HTMLButtonElement>;
}

function AccountMenu({ children, triggerRef }: AccountMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <AccountMenuTrigger triggerRef={triggerRef} />

      <PopoverContent align="end" className="mt-1 w-full max-w-xs p-0">
        <AccountMenuUserInfo />
        {children}
        <AccountMenuContent onNavigate={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

export default AccountMenu;
