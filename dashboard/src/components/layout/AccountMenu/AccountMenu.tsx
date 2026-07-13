import { useApolloClient } from '@apollo/client';
import { useState } from 'react';
import { NavLink } from '@/components/common/NavLink';
import { ThemeSwitcher } from '@/components/common/ThemeSwitcher';
import { Avatar } from '@/components/ui/v2/Avatar';
import { Button } from '@/components/ui/v3/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import { Separator } from '@/components/ui/v3/separator';
import { useUserData } from '@/hooks/useUserData';
import { useAuth } from '@/providers/Auth';
import { getDashboardVersion } from '@/utils/env';

interface AccountMenuContentProps {
  onClose: VoidFunction;
}

function AccountMenuContent({ onClose }: AccountMenuContentProps) {
  const user = useUserData();
  const { signout } = useAuth();
  const apolloClient = useApolloClient();

  async function handleSignOut() {
    onClose();
    await apolloClient.clearStore();
    await signout();
  }

  return (
    <div className="grid grid-flow-row">
      <div className="grid grid-flow-col items-center justify-start gap-3 p-4">
        <Avatar
          alt={user?.displayName}
          src={user?.avatarUrl}
          className="h-10 w-10"
        >
          {user?.displayName}
        </Avatar>

        <div className="grid grid-flow-row gap-0.5">
          <span className="font-semibold">{user?.displayName}</span>
          <span className="text-muted-foreground text-sm">{user?.email}</span>
        </div>
      </div>

      <Separator />

      <div className="p-2">
        <ThemeSwitcher />
      </div>

      <Separator />

      <div className="grid grid-flow-row gap-1 p-2">
        <NavLink
          variant="ghost"
          className="h-9 w-full justify-start px-2"
          href="/account"
          onClick={onClose}
        >
          Account Settings
        </NavLink>

        <Button
          variant="ghost"
          className="h-9 w-full justify-start px-2 text-error-main hover:bg-error-bg"
          onClick={handleSignOut}
        >
          Sign out
        </Button>
      </div>

      <Separator />

      <div className="py-4 text-center text-muted-foreground text-xs">
        Dashboard Version: {getDashboardVersion()}
      </div>
    </div>
  );
}

function AccountMenu() {
  const user = useUserData();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="rounded-full border-0 bg-transparent p-0">
        <Avatar
          className="h-7 w-7 self-center rounded-full"
          alt={user?.displayName}
          src={user?.avatarUrl}
        >
          {user?.displayName}
        </Avatar>
      </PopoverTrigger>

      <PopoverContent align="end" className="mt-1 w-full max-w-xs p-0">
        <AccountMenuContent onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

export default AccountMenu;
