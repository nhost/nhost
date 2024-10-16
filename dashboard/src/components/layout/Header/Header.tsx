import { useDialog } from '@/components/common/DialogProvider';
import { NavLink } from '@/components/common/NavLink';
import { AccountMenu } from '@/components/layout/AccountMenu';
import { LocalAccountMenu } from '@/components/layout/LocalAccountMenu';
import { MobileNav } from '@/components/layout/MobileNav';
import { Logo } from '@/components/presentational/Logo';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { GraphiteIcon } from '@/components/ui/v2/icons/GraphiteIcon';
import { DevAssistant } from '@/features/ai/DevAssistant';
import { AnnouncementsTray } from '@/features/orgs/components/members/components/AnnouncementsTray';
import { NotificationsTray } from '@/features/orgs/components/members/components/NotificationsTray';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { getToastStyleProps } from '@/utils/constants/settings';
import type { DetailedHTMLProps, HTMLProps, PropsWithoutRef } from 'react';
import { toast } from 'react-hot-toast';
import { twMerge } from 'tailwind-merge';
import BreadcrumbNav from './BreadcrumbNav';

export interface HeaderProps
  extends PropsWithoutRef<
    DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>
  > {}

export default function Header({ className, ...props }: HeaderProps) {
  const isPlatform = useIsPlatform();
  const { openDrawer } = useDialog();
  const { project } = useProject();
  const { currentProject: workspaceProject } = useCurrentWorkspaceAndProject();
  const { currentOrg: org } = useOrgs();

  const openDevAssistant = () => {
    // The dev assistant can be only answer questions related to a particular project
    if (!project && !workspaceProject) {
      toast.error('You need to be inside a project to open the Assistant', {
        style: getToastStyleProps().style,
        ...getToastStyleProps().error,
      });

      return;
    }

    if (org && project) {
      openDrawer({
        title: <GraphiteIcon />,
        component: <DevAssistant />,
      });
    } else {
      openDrawer({
        title: <GraphiteIcon />,
        component: <WorkspaceProjectDevAssistant />,
      });
    }
  };

  return (
    <Box
      component="header"
      className={twMerge(
        'relative z-40 grid w-full transform-gpu grid-flow-col items-center justify-between gap-2 border-b px-4',
        className,
      )}
      sx={{ backgroundColor: 'background.paper' }}
      {...props}
    >
      <div className="w-6 h-6 mr-2">
        <Logo className="w-6 h-6 mx-auto cursor-pointer" />
      </div>

      <BreadcrumbNav />

      <div className="items-center hidden grid-flow-col gap-1 sm:grid">
        <Button className="rounded-full" onClick={openDevAssistant}>
          <GraphiteIcon className="w-4 h-4" />
        </Button>

        <NotificationsTray />

        <AnnouncementsTray />

        {isPlatform && (
          <NavLink
            underline="none"
            href="/support"
            className="mr-1 rounded-md px-2.5 py-1.5 text-sm motion-safe:transition-colors"
            sx={{
              color: 'text.primary',
              '&:hover': { backgroundColor: 'grey.200' },
            }}
            target="_blank"
            rel="noopener noreferrer"
          >
            Support
          </NavLink>
        )}

        <NavLink
          underline="none"
          href="https://docs.nhost.io"
          className="mr-2 rounded-md px-2.5 py-1.5 text-sm motion-safe:transition-colors"
          sx={{
            color: 'text.primary',
            '&:hover': { backgroundColor: 'grey.200' },
          }}
          target="_blank"
          rel="noopener noreferrer"
        >
          Docs
        </NavLink>

        {isPlatform ? <AccountMenu /> : <LocalAccountMenu />}
      </div>

      <MobileNav className="sm:hidden" />
    </Box>
  );
}
