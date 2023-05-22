import { NavLink } from '@/components/common/NavLink';
import { ThemeSwitcher } from '@/components/common/ThemeSwitcher';
import { Avatar } from '@/ui/Avatar';
import { Box } from '@/ui/v2/Box';
import { Button } from '@/ui/v2/Button';
import { Divider } from '@/ui/v2/Divider';
import { Dropdown, useDropdown } from '@/ui/v2/Dropdown';
import { Text } from '@/ui/v2/Text';
import { useApolloClient } from '@apollo/client';
import { useSignOut, useUserData } from '@nhost/nextjs';
import getConfig from 'next/config';
import { useRouter } from 'next/router';

function AccountMenuContent() {
  const user = useUserData();
  const { signOut } = useSignOut();
  const router = useRouter();
  const apolloClient = useApolloClient();
  const { handleClose } = useDropdown();
  const { publicRuntimeConfig } = getConfig();

  return (
    <Box className="grid grid-flow-row">
      <Box className="grid grid-flow-col items-center justify-start gap-4 p-4">
        <Avatar
          name={user?.displayName}
          avatarUrl={user?.avatarUrl}
          className="h-10 w-10"
        />

        <Box className="grid grid-flow-row gap-0.5">
          <Text className="font-semibold">{user?.displayName}</Text>
          <Text color="secondary" className="text-sm">
            {user?.email}
          </Text>
        </Box>
      </Box>

      <Divider />

      <Box className="grid grid-flow-row gap-2 p-2">
        <ThemeSwitcher
          label="Theme"
          variant="inline"
          fullWidth
          className="grid-cols-auto justify-between px-2"
          slotProps={{
            label: { className: '!text-sm+' },
          }}
        />

        <Button
          variant="borderless"
          color="secondary"
          className="w-full justify-start"
          LinkComponent={NavLink}
          href="/account/profile"
          onClick={handleClose}
        >
          Settings
        </Button>
      </Box>

      <Divider />

      <Box className="p-2">
        <Button
          color="error"
          variant="borderless"
          className="w-full justify-start"
          onClick={async () => {
            handleClose();
            await apolloClient.clearStore();
            await signOut();
            await router.push('/signin');
          }}
        >
          Sign out
        </Button>
      </Box>

      <Divider />

      <Box className="py-4">
        <Text className="text-center text-xs" color="disabled">
          Dashboard Version: {publicRuntimeConfig?.version || 'n/a'}
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
          name={user?.displayName}
          avatarUrl={user?.avatarUrl}
        />
      </Dropdown.Trigger>

      <Dropdown.Content PaperProps={{ className: 'mt-1 max-w-xs w-full' }}>
        <AccountMenuContent />
      </Dropdown.Content>
    </Dropdown.Root>
  );
}

export default AccountMenu;
