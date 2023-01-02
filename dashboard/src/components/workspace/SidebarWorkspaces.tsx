import { Avatar } from '@/ui/Avatar';
import Text from '@/ui/v2/Text';
import { nhost } from '@/utils/nhost';
import { useGetWorkspacesQuery } from '@/utils/__generated__/graphql';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';

export default function SidebarWorkspaces() {
  const user = nhost.auth.getUser();
  const { data, loading, startPolling, stopPolling } = useGetWorkspacesQuery();

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
        <div className="flex flex-row">
          <svg
            className="ml-1 h-4 w-4 animate-spin self-center text-dark"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <Text size="tiny" className="ml-2 self-center" color="greyscaleGrey">
            Creating first workspace...
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 mb-4 grid grid-flow-row gap-1.5">
      {data?.workspaces?.map(({ name, slug, id, creatorUserId }) => (
        <Link href={`/${slug}`} passHref key={id}>
          <a
            className="flex flex-row items-center rounded-md p-1 font-display text-sm+ font-medium leading-6.5 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none motion-safe:transition-colors"
            aria-label={name}
            href={slug}
          >
            {name === 'Default Workspace' && creatorUserId === user.id ? (
              <Avatar
                className="h-8 w-8 self-center rounded-full"
                name={user?.displayName}
                avatarUrl={user?.avatarUrl}
              />
            ) : (
              <div className="inline-block h-8 w-8 overflow-hidden rounded-lg">
                <Image
                  src="/logos/new.svg"
                  alt="Nhost Logo"
                  width={32}
                  height={32}
                />
              </div>
            )}

            <Text className="ml-2 font-medium">{name}</Text>
          </a>
        </Link>
      ))}
    </div>
  );
}
