import { useWorkspaceContext } from '@/context/workspace-context';
import { useUserDataContext } from '@/context/workspace1-context';
import { Button } from '@/ui/Button';
import { Text } from '@/ui/Text';
import Link from 'next/link';

export function NoApplications() {
  const { userContext } = useUserDataContext();
  const { workspaceContext } = useWorkspaceContext();

  return (
    <div className="noapps mt-4 h-80 rounded-md text-center font-display font-normal">
      <div className="pt-12">
        <Text
          variant="subHeading"
          size="big"
          className="text-center text-white"
        >
          Welcome to Nhost!
        </Text>
        <Text variant="body" className="mt-2 text-white">
          Let’s set up your first backend – the Nhost way.
        </Text>
        <div className="inline-block pt-10">
          <Link href="/new" passHref>
            <Button
              variant="secondary"
              disabled={
                !workspaceContext.id && userContext.workspaces.length === 0
              }
            >
              Create Your First Project
            </Button>
          </Link>
        </div>
        <div>
          <Text
            variant="body"
            size="normal"
            className="mt-9 text-white opacity-40"
          >
            Looking for your old projects? They&apos;re still on
            console.nhost.io during this beta.
          </Text>
        </div>
      </div>
    </div>
  );
}

export default NoApplications;
