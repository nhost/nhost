import { ChangePasswordModal } from '@/components/applications/ChangePasswordModal';
import { Avatar } from '@/ui/Avatar';
import { Modal } from '@/ui/Modal';
import Button from '@/ui/v2/Button';
import { Dropdown, useDropdown } from '@/ui/v2/Dropdown';
import Text from '@/ui/v2/Text';
import { nhost } from '@/utils/nhost';
import { useApolloClient } from '@apollo/client';
import { useUserData } from '@nhost/nextjs';
import Image from 'next/image';
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
  const [clicked, setClicked] = useState(false);
  const { handleClose } = useDropdown();

  return (
    <div className="relative grid w-account grid-flow-row gap-5 p-6">
      <Button
        variant="borderless"
        color="secondary"
        className="absolute top-6 right-4 grid grid-flow-col items-center gap-1 self-start font-medium"
        onClick={async () => {
          router.push('/signin');
          await nhost.auth.signOut();
          await client.resetStore();
        }}
        aria-label="Sign Out"
      >
        Sign Out
        <Image
          src="/assets/Power.svg"
          alt="Power icon"
          width={16}
          height={16}
        />
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

      {!clicked ? (
        <Button
          variant="outlined"
          color="secondary"
          onClick={() => setClicked(!clicked)}
        >
          Account Options
        </Button>
      ) : (
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
      )}
    </div>
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
        <Dropdown.Trigger hideChevron>
          <Avatar
            className="h-7 w-7 self-center rounded-full"
            name={user?.displayName}
            avatarUrl={user?.avatarUrl}
          />
        </Dropdown.Trigger>

        <Dropdown.Content>
          <AccountMenuContent
            onChangePasswordClick={() => setChangePasswordModal(true)}
          />
        </Dropdown.Content>
      </Dropdown.Root>
    </>
  );
}

export default AccountMenu;
