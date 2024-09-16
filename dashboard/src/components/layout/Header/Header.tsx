import { useDialog } from '@/components/common/DialogProvider';
import { NavLink } from '@/components/common/NavLink';
import { AccountMenu } from '@/components/layout/AccountMenu';
import { LocalAccountMenu } from '@/components/layout/LocalAccountMenu';
import { MobileNav } from '@/components/layout/MobileNav';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { GraphiteIcon } from '@/components/ui/v2/icons/GraphiteIcon';
import { DevAssistant as WorkspaceProjectDevAssistant } from '@/features/ai/DevAssistant';
import { AnnouncementsTray } from '@/features/orgs/components/members/components/AnnouncementsTray';
import { NotificationsTray } from '@/features/orgs/components/members/components/NotificationsTray';
import { DevAssistant } from '@/features/orgs/projects/ai/DevAssistant';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { getToastStyleProps } from '@/utils/constants/settings';
// import { useRouter } from 'next/router';
import type { DetailedHTMLProps, HTMLProps, PropsWithoutRef } from 'react';
import { toast } from 'react-hot-toast';
import { twMerge } from 'tailwind-merge';
import BreadcrumbNav from './BreadcrumbNav';

export interface HeaderProps
  extends PropsWithoutRef<
    DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>
  > {}

export default function Header({ className, ...props }: HeaderProps) {
  // const router = useRouter();

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
        'z-40 grid h-12 w-full transform-gpu grid-flow-col items-center justify-between gap-2 border-b-1 px-4 py-3',
        className,
      )}
      sx={{ backgroundColor: 'background.paper' }}
      {...props}
    >
      <BreadcrumbNav />
      {/* <div className="grid items-center grid-flow-col gap-3">
        <NavLink href="/" className="w-fit">
          <Logo className="mx-auto cursor-pointer" />
        </NavLink>

        {(router.query.workspaceSlug || router.query.appSlug) && (
          <Breadcrumbs aria-label="Workspace breadcrumbs" />
        )}

        {isProjectUpdating && (
          <Chip size="small" label="Updating" color="warning" />
        )}
        {isProjectMigratingDatabase && (
          <Chip
            size="small"
            label="Upgrading Postgres version"
            color="warning"
          />
        )}
      </div> */}

      <BreadcrumbNav />

      <div className="hidden grid-flow-col items-center gap-1 sm:grid">
        <Button className="rounded-full" onClick={openDevAssistant}>
          <GraphiteIcon className="h-4 w-4" />
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
