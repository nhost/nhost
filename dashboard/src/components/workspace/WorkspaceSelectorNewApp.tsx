import { Avatar } from '@/ui/Avatar';
import { Text } from '@/ui/Text';
import { nhost } from '@/utils/nhost';
import Image from 'next/image';

export function WorkspaceSelectorNewApp({ option }: any) {
  const user = nhost.auth.getUser();

  return (
    <div className="flex flex-row items-center py-0.5">
      {option.name === 'Default Workspace' ? (
        <Avatar
          className="h-6 w-6 rounded-full"
          name={user?.displayName}
          avatarUrl={user?.avatarUrl}
        />
      ) : (
        <div className="h-6 w-6 overflow-hidden rounded-md">
          <Image src="/logos/new.svg" alt="Nhost Logo" width={24} height={24} />
        </div>
      )}
      <Text className="ml-2 font-medium" color="greyscaleDark">
        {option.name}
      </Text>
    </div>
  );
}

export default WorkspaceSelectorNewApp;
