import { useDialog } from '@/components/common/DialogProvider';
import { NavLink } from '@/components/common/NavLink';
import { AccountMenu } from '@/components/layout/AccountMenu';
import { LocalAccountMenu } from '@/components/layout/LocalAccountMenu';
import { MobileNav } from '@/components/layout/MobileNav';
import { Logo } from '@/components/presentational/Logo';
import { Box } from '@/components/ui/v2/Box';
import { GraphiteIcon } from '@/components/ui/v2/icons/GraphiteIcon';
import { Button } from '@/components/ui/v3/button';
import { DevAssistant as WorkspaceProjectDevAssistant } from '@/features/ai/DevAssistant';
import { AnnouncementsTray } from '@/features/orgs/components/members/components/AnnouncementsTray';
import { NotificationsTray } from '@/features/orgs/components/members/components/NotificationsTray';
import { DevAssistant } from '@/features/orgs/projects/ai/DevAssistant';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
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
      <div className="mr-2 h-6 w-6">
        <Logo className="mx-auto h-6 w-6 cursor-pointer" />
      </div>

      <BreadcrumbNav />

      <div className="hidden grid-flow-col items-center gap-1 sm:grid">
        <Button
          variant="outline"
          className="h-8 w-8"
          onClick={openDevAssistant}
        >
          <GraphiteIcon className="h-4" />
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
