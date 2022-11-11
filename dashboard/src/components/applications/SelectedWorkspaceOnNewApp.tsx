import { Avatar } from '@/ui/Avatar';
import { Text } from '@/ui/Text';
import { nhost } from '@/utils/nhost';
import Image from 'next/image';

export function SelectedWorkspaceOnNewApp({ current }: any) {
  const user = nhost.auth.getUser();

  return (
    <div className="flex flex-row space-x-2 self-center">
      {current.name === 'Default Workspace' ? (
        <Avatar
          className="h-5 w-5 self-center rounded-full"
          name={user?.displayName}
          avatarUrl={user?.avatarUrl}
        />
      ) : (
        <div className="h-5 w-5 overflow-hidden rounded-md">
          <Image src="/logos/new.svg" alt="Nhost Logo" width={20} height={20} />
        </div>
      )}
      <Text size="small" color="greyscaleDark" className="font-normal">
        {current.name}
      </Text>
    </div>
  );
}
export default SelectedWorkspaceOnNewApp;
