import { Avatar } from '@/ui/Avatar';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Button from '@/ui/v2/Button';
import Text from '@/ui/v2/Text';
import { nhost } from '@/utils/nhost';
import { useGetWorkspacesQuery } from '@/utils/__generated__/graphql';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';

export default function SidebarWorkspaces() {
  const user = nhost.auth.getUser();
  const { data, loading, startPolling, stopPolling } = useGetWorkspacesQuery({
    fetchPolicy: 'cache-and-network',
  });

  useEffect(() => {
    startPolling(1000);
  }, [startPolling]);

  // keep polling for workspaces until there is a workspace available.
  // We do this because when a user signs up a workspace is created automatically
  // and the serverless function can take some time to complete.
  useEffect(() => {
    if (data?.workspaces?.length > 0) {
      stopPolling();
    }
  }, [data, stopPolling]);

  if (loading || data?.workspaces?.length === 0) {
    return (
      <div className="mt-3 mb-4 space-y-2">
        <ActivityIndicator label="Creating first workspace..." />
      </div>
    );
  }

  return (
    <div className="mt-3 mb-4 grid grid-flow-row gap-1.5">
      {data?.workspaces?.map(({ name, slug, id, creatorUserId }) => (
        <Link href={`/${slug}`} passHref key={id}>
          <Button
            aria-label={name}
            variant="borderless"
            color="secondary"
            className="justify-start"
            size="small"
          >
            {name === 'Default Workspace' && creatorUserId === user.id ? (
              <Avatar
                className="self-center w-8 h-8 rounded-full"
                name={user?.displayName}
                avatarUrl={user?.avatarUrl}
              />
            ) : (
              <div className="inline-block w-8 h-8 overflow-hidden rounded-lg">
                <Image
                  src="/logos/new.svg"
                  alt="Nhost Logo"
                  width={32}
                  height={32}
                />
              </div>
            )}

            <Text className="ml-2 font-medium">{name}</Text>
          </Button>
        </Link>
      ))}
    </div>
  );
}
