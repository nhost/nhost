import { ChangePasswordModal } from '@/components/applications/ChangePasswordModal';
import { ThemeSwitcher } from '@/components/common/ThemeSwitcher';
import { Avatar } from '@/ui/Avatar';
import { Modal } from '@/ui/Modal';
import { Box } from '@/ui/v2/Box';
import { Button } from '@/ui/v2/Button';
import { Dropdown, useDropdown } from '@/ui/v2/Dropdown';
import { PowerIcon } from '@/ui/v2/icons/PowerIcon';
import { Text } from '@/ui/v2/Text';
import { useApolloClient } from '@apollo/client';
import { useSignOut, useUserData } from '@nhost/nextjs';
import getConfig from 'next/config';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface AccountMenuContentProps {
  onChangePasswordClick: VoidFunction;
}

function AccountMenuContent({
  onChangePasswordClick,
}: AccountMenuContentProps) {
  const user = useUserData();
  const { signOut } = useSignOut();
  const router = useRouter();
  const apolloClient = useApolloClient();
  const { handleClose } = useDropdown();
  const { publicRuntimeConfig } = getConfig();

  return (
    <Box className="relative grid w-full grid-flow-row gap-5 p-6">
      <div className="grid grid-flow-row justify-center">
        <Avatar
          className="mx-auto mb-2 h-16 w-16 rounded-full"
          name={user?.displayName}
          avatarUrl={user?.avatarUrl}
        />

        <Text variant="h3" component="h2" className="text-center">
          {user?.displayName}
        </Text>

        <Text className="text-center font-medium">{user?.email}</Text>
      </div>

      <div className="grid grid-flow-row gap-2">
        <Button
          variant="outlined"
          color="secondary"
          onClick={() => {
            onChangePasswordClick();
            handleClose();
          }}
        >
          Change Password
        </Button>

        <Button
          variant="outlined"
          color="secondary"
          onClick={async () => {
            await apolloClient.clearStore();
            await signOut();
            await router.push('/signin');
          }}
          endIcon={<PowerIcon className="mr-1 h-4 w-4" />}
        >
          Sign Out
        </Button>
      </div>

      <ThemeSwitcher label="Theme" />

      <Text className="text-center text-xs" color="disabled">
        Dashboard Version: {publicRuntimeConfig?.version || 'n/a'}
      </Text>
    </Box>
  );
}

export function AccountMenu() {
  const user = useUserData();
  const [changePasswordModal, setChangePasswordModal] = useState(false);

  useEffect(() => {
    if (window.location.hash.search('type=passwordReset') !== -1) {
      setChangePasswordModal(true);
    }
  }, []);

  return (
    <>
      <Modal
        showModal={changePasswordModal}
        close={() => setChangePasswordModal(false)}
      >
        <ChangePasswordModal close={() => setChangePasswordModal(false)} />
      </Modal>

      <Dropdown.Root>
        <Dropdown.Trigger hideChevron className="rounded-full">
          <Avatar
            className="h-7 w-7 self-center rounded-full"
            name={user?.displayName}
            avatarUrl={user?.avatarUrl}
          />
        </Dropdown.Trigger>

        <Dropdown.Content PaperProps={{ className: 'mt-1 max-w-xs w-full' }}>
          <AccountMenuContent
            onChangePasswordClick={() => setChangePasswordModal(true)}
          />
        </Dropdown.Content>
      </Dropdown.Root>
    </>
  );
}

export default AccountMenu;
