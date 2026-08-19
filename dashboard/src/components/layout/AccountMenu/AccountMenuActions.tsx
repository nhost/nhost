import { useApolloClient } from '@apollo/client';
import { NavLink } from '@/components/common/NavLink';
import { Button } from '@/components/ui/v3/button';
import { Separator } from '@/components/ui/v3/separator';
import { useAuth } from '@/providers/Auth';

interface AccountMenuActionsProps {
  onAccountSettingsClick?: VoidFunction;
}

export default function AccountMenuActions({
  onAccountSettingsClick,
}: AccountMenuActionsProps) {
  const apolloClient = useApolloClient();
  const { signout } = useAuth();

  async function handleSignOut() {
    await apolloClient.clearStore();
    await signout();
  }

  return (
    <>
      <Separator className="mt-3 sm:mt-0" />

      <div className="grid grid-flow-row gap-1 pt-2 sm:p-2">
        <NavLink
          variant="ghost"
          className="h-9 w-full justify-start px-2"
          href="/account"
          onClick={onAccountSettingsClick}
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
    </>
  );
}
