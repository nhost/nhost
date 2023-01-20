import { ChangePasswordModal } from '@/components/applications/ChangePasswordModal';
import ThemeSwitcher from '@/components/common/ThemeSwitcher';
import { Avatar } from '@/ui/Avatar';
import { Modal } from '@/ui/Modal';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import { Dropdown, useDropdown } from '@/ui/v2/Dropdown';
import PowerIcon from '@/ui/v2/icons/PowerIcon';
import Text from '@/ui/v2/Text';
import { nhost } from '@/utils/nhost';
import { useApolloClient } from '@apollo/client';
import { useUserData } from '@nhost/nextjs';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface AccountMenuContentProps {
  onChangePasswordClick: VoidFunction;
}

function AccountMenuContent({
  onChangePasswordClick,
}: AccountMenuContentProps) {
  const user = useUserData();
  const router = useRouter();
  const client = useApolloClient();
  const { handleClose } = useDropdown();

  return (
    <Box className="relative grid w-account grid-flow-row gap-5 p-6">
      <Button
        variant="borderless"
        color="secondary"
        className="absolute top-6 right-4 grid grid-flow-col items-center gap-px self-start font-medium"
        onClick={async () => {
          router.push('/signin');
          await nhost.auth.signOut();
          await client.resetStore();
        }}
        endIcon={<PowerIcon className="w-4 h-4 mr-1" />}
      >
        Sign Out
      </Button>

      <div className="grid grid-flow-row justify-center">
        <Avatar
          className="mx-auto mb-2 h-16 w-16 rounded-full"
          name={user?.displayName}
          avatarUrl={user?.avatarUrl}
        />

        <Text variant="h3" component="h2" className="text-center">
          {nhost.auth.getUser()?.displayName}
        </Text>

        <Text className="text-center font-medium">
          {nhost.auth.getUser()?.email}
        </Text>
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

        <Button color="error" disabled>
          Remove Account
        </Button>
      </div>

      <ThemeSwitcher label="Theme" fullWidth />
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

        <Dropdown.Content PaperProps={{ className: 'mt-1' }}>
          <AccountMenuContent
            onChangePasswordClick={() => setChangePasswordModal(true)}
          />
        </Dropdown.Content>
      </Dropdown.Root>
    </>
  );
}

export default AccountMenu;
