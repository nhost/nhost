import { useWorkspaceContext } from '@/context/workspace-context';
import { useUserDataContext } from '@/context/workspace1-context';
import Button from '@/ui/v2/Button';
import Text from '@/ui/v2/Text';
import { darken } from '@mui/system';
import Link from 'next/link';

export function NoApplications() {
  const { userContext } = useUserDataContext();
  const { workspaceContext } = useWorkspaceContext();

  return (
    <div className="noapps mt-4 h-80 rounded-md text-center font-display font-normal">
      <div className="pt-12">
        <Text
          className="text-center text-2xl font-semibold"
          sx={{ color: 'common.white' }}
        >
          Welcome to Nhost!
        </Text>
        <Text className="mt-2" sx={{ color: 'common.white' }}>
          Let&apos;s set up your first backend - the Nhost way.
        </Text>
        <div className="inline-block pt-10">
          <Link href="/new" passHref>
            <Button
              sx={{
                backgroundColor: (theme) =>
                  `${theme.palette.common.white} !important`,
                color: (theme) => `${theme.palette.common.black} !important`,
                '&:hover': {
                  backgroundColor: (theme) =>
                    `${darken(theme.palette.common.white, 0.1)} !important`,
                },
              }}
              disabled={
                !workspaceContext.id && userContext.workspaces.length === 0
              }
            >
              Create Your First Project
            </Button>
          </Link>
        </div>
        <div>
          <Text className="mt-9 opacity-40" sx={{ color: 'common.white' }}>
            Looking for your old projects? They&apos;re still on
            console.nhost.io during this beta.
          </Text>
        </div>
      </div>
    </div>
  );
}

export default NoApplications;
