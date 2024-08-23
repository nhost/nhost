import { useDialog } from '@/components/common/DialogProvider';
import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { GitHubIcon } from '@/components/ui/v2/icons/GitHubIcon';
import { PlusCircleIcon } from '@/components/ui/v2/icons/PlusCircleIcon';
import { Text } from '@/components/ui/v2/Text';
import { Announcements } from '@/features/projects/common/components/Announcements';
import { EditWorkspaceNameForm } from '@/features/projects/workspaces/components/EditWorkspaceNameForm';
import type { Workspace } from '@/types/application';
import Image from 'next/image';
import NavLink from 'next/link';
import { twMerge } from 'tailwind-merge';
import Resource from './Resource';

export interface WorkspaceSidebarProps extends BoxProps {
  /**
   * List of workspaces to be displayed.
   */
  workspaces: Workspace[];
}

export default function WorkspaceSidebar({
  className,
  workspaces,
  ...props
}: WorkspaceSidebarProps) {
  const { openDialog } = useDialog();

  return (
    <Box
      component="aside"
      className={twMerge(
        'grid w-full grid-flow-row content-start gap-8 md:grid',
        className,
      )}
      {...props}
    >
      <Announcements />

      <section className="grid grid-flow-row gap-2">
        <Text color="secondary">My Organisations</Text>

        <span>Query list of orgs here</span>

        <Button
          variant="borderless"
          color="secondary"
          startIcon={<PlusCircleIcon />}
          className="justify-self-start"
          onClick={() => {
            openDialog({
              title: (
                <span className="grid grid-flow-row">
                  <span>New Orgranisation</span>
                </span>
              ),
              component: <EditWorkspaceNameForm />,
            });
          }}
        >
          New Orgranisation
        </Button>
      </section>

      <section className="grid grid-flow-row gap-2">
        <Text color="secondary">Resources</Text>

        <div className="grid grid-flow-row gap-2">
          <Resource
            text="Documentation"
            logo="Note"
            link="https://docs.nhost.io"
          />
          <Resource
            text="JavaScript Client"
            logo="js"
            link="https://docs.nhost.io/reference/javascript/"
          />
          <Resource
            text="Nhost CLI"
            logo="CLI"
            link="https://docs.nhost.io/platform/cli"
          />
        </div>
      </section>

      <section className="grid grid-flow-row gap-2">
        <NavLink
          href="https://github.com/nhost/nhost"
          passHref
          target="_blank"
          rel="noreferrer noopener"
          legacyBehavior
        >
          <Button
            className="grid w-full grid-flow-col gap-1"
            variant="outlined"
            color="secondary"
            startIcon={<GitHubIcon />}
          >
            Star us on GitHub
          </Button>
        </NavLink>

        <NavLink
          href="https://discord.com/invite/9V7Qb2U"
          passHref
          target="_blank"
          rel="noreferrer noopener"
          legacyBehavior
        >
          <Button
            className="grid w-full grid-flow-col gap-1"
            variant="outlined"
            color="secondary"
            aria-labelledby="discord-button-label"
          >
            <Image
              src="/assets/brands/discord.svg"
              alt="Discord Logo"
              width={24}
              height={24}
            />

            <span id="discord-button-label">Join Discord</span>
          </Button>
        </NavLink>
      </section>
    </Box>
  );
}
