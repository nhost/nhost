import { useApolloClient } from '@apollo/client';
import { NavLink } from '@/components/common/NavLink';
import { ThemeSwitcher } from '@/components/common/ThemeSwitcher';
import { Avatar } from '@/components/ui/v2/Avatar';
import { Box } from '@/components/ui/v2/Box';
import { Divider } from '@/components/ui/v2/Divider';
import { Dropdown, useDropdown } from '@/components/ui/v2/Dropdown';
import { Text } from '@/components/ui/v2/Text';
import { Button } from '@/components/ui/v3/button';
import { useUserData } from '@/hooks/useUserData';
import { useAuth } from '@/providers/Auth';
import { getDashboardVersion } from '@/utils/env';

function AccountMenuContent() {
  const user = useUserData();
  const { signout } = useAuth();
  const apolloClient = useApolloClient();
  const { handleClose } = useDropdown();

  async function handleSignOut() {
    handleClose();
    await apolloClient.clearStore();
    await signout();
  }

  return (
    <Box className="grid grid-flow-row">
      <Box className="grid grid-flow-col items-center justify-start gap-3 p-4">
        <Avatar
          alt={user?.displayName}
          src={user?.avatarUrl}
          className="h-10 w-10"
        >
          {user?.displayName}
        </Avatar>

        <Box className="grid grid-flow-row gap-0.5">
          <Text className="font-semibold">{user?.displayName}</Text>
          <Text color="secondary" className="text-sm">
            {user?.email}
          </Text>
        </Box>
      </Box>

      <Divider />

      <Box className="p-2">
        <ThemeSwitcher
          label="Theme"
          variant="inline"
          fullWidth
          className="grid-cols-auto justify-between px-2"
          slotProps={{
            label: { className: '!text-sm+' },
          }}
        />
      </Box>

      <Divider />

      <Box className="grid grid-flow-row gap-1 p-2">
        <NavLink
          variant="ghost"
          className="h-9 w-full justify-start px-2"
          href="/account"
          onClick={handleClose}
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
      </Box>

      <Divider />

      <Box className="py-4">
        <Text className="text-center text-xs" color="disabled">
          Dashboard Version: {getDashboardVersion()}
        </Text>
      </Box>
    </Box>
  );
}

function AccountMenu() {
  const user = useUserData();

  return (
    <Dropdown.Root>
      <Dropdown.Trigger hideChevron className="rounded-full">
        <Avatar
          className="h-7 w-7 self-center rounded-full"
          alt={user?.displayName}
          src={user?.avatarUrl}
        >
          {user?.displayName}
        </Avatar>
      </Dropdown.Trigger>

      <Dropdown.Content PaperProps={{ className: 'mt-1 max-w-xs w-full' }}>
        <AccountMenuContent />
      </Dropdown.Content>
    </Dropdown.Root>
  );
}

export default AccountMenu;
