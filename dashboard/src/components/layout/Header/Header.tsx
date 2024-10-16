import { useDialog } from '@/components/common/DialogProvider';
import { NavLink } from '@/components/common/NavLink';
import { AccountMenu } from '@/components/layout/AccountMenu';
import { LocalAccountMenu } from '@/components/layout/LocalAccountMenu';
import { MobileNav } from '@/components/layout/MobileNav';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { GraphiteIcon } from '@/components/ui/v2/icons/GraphiteIcon';
import { DevAssistant } from '@/features/ai/DevAssistant';
import { NotificationsTray } from '@/features/orgs/components/members/components/NotificationsTray';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { ApplicationStatus } from '@/types/application';
import { getToastStyleProps } from '@/utils/constants/settings';
import type { DetailedHTMLProps, HTMLProps, PropsWithoutRef } from 'react';
import { useEffect } from 'react';
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

  const { currentProject, refetch: refetchProject } =
    useCurrentWorkspaceAndProject();

  const isProjectUpdating =
    currentProject?.appStates[0]?.stateId === ApplicationStatus.Updating;

  const isProjectMigratingDatabase =
    currentProject?.appStates[0]?.stateId === ApplicationStatus.Migrating;

  // Poll for project updates
  useEffect(() => {
    if (!isProjectUpdating && !isProjectMigratingDatabase) {
      return () => {};
    }

    const interval = setInterval(async () => {
      await refetchProject();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [isProjectUpdating, isProjectMigratingDatabase, refetchProject]);

  const openDevAssistant = () => {
    // The dev assistant can be only answer questions related to a particular project
    if (!currentProject) {
      toast.error('You need to be inside a project to open the Assistant', {
        style: getToastStyleProps().style,
        ...getToastStyleProps().error,
      });

      return;
    }

    openDrawer({
      title: <GraphiteIcon />,
      component: <DevAssistant />,
    });
  };

  return (
    <Box
      component="header"
      className={twMerge(
        'z-40 grid h-12 w-full transform-gpu grid-flow-col items-center justify-between gap-2 border-b px-4 py-3',
        className,
      )}
      sx={{ backgroundColor: 'background.paper' }}
      {...props}
    >
      <BreadcrumbNav />

      <div className="items-center hidden grid-flow-col gap-2 sm:grid">
        <Button className="rounded-full" onClick={openDevAssistant}>
          <GraphiteIcon className="w-4 h-4" />
        </Button>

        <NotificationsTray />

        {isPlatform && (
          <NavLink
            underline="none"
            href="/support"
            className="mr-2 rounded-md px-2.5 py-1.5 text-sm motion-safe:transition-colors"
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
