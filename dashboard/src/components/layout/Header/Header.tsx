import type { DetailedHTMLProps, HTMLProps, PropsWithoutRef } from 'react';
import { toast } from 'react-hot-toast';
import { twMerge } from 'tailwind-merge';
import { useDialog } from '@/components/common/DialogProvider';
import { NavLink } from '@/components/common/NavLink';
import { AccountMenu } from '@/components/layout/AccountMenu';
import { LocalAccountMenu } from '@/components/layout/LocalAccountMenu';
import { MobileNav } from '@/components/layout/MobileNav';
import { Logo } from '@/components/presentational/Logo';
import { Box } from '@/components/ui/v2/Box';
import { GraphiteIcon } from '@/components/ui/v2/icons/GraphiteIcon';
import { Button } from '@/components/ui/v3/button';
import { AnnouncementsTray } from '@/features/orgs/components/members/components/AnnouncementsTray';
import { NotificationsTray } from '@/features/orgs/components/members/components/NotificationsTray';
import { DevAssistant } from '@/features/orgs/projects/ai/DevAssistant';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useProjectColor } from '@/features/orgs/projects/common/hooks/useProjectColor';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { getToastStyleProps } from '@/utils/constants/settings';
import OrgsComboBox from './OrgsComboBox';

export interface HeaderProps
  extends PropsWithoutRef<
    DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>
  > {}

export default function Header({ className, ...props }: HeaderProps) {
  const isPlatform = useIsPlatform();
  const { openDrawer } = useDialog();
  const { project } = useProject();
  const { entry: colorEntry } = useProjectColor(project?.id);

  const openDevAssistant = () => {
    // The dev assistant can be only answer questions related to a particular project
    if (!project) {
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
        'relative z-40 grid w-full transform-gpu grid-flow-col items-center justify-between gap-2 border-b-2 px-4',
        colorEntry?.border,
        className,
      )}
      sx={{ backgroundColor: 'background.paper' }}
      {...props}
    >
      <div className="flex items-center gap-2">
        <Logo className="h-6 w-6 cursor-pointer" />
        <OrgsComboBox />
      </div>

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
            className="mr-1 rounded-md px-2.5 py-1.5 text-foreground text-sm hover:bg-accent motion-safe:transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            Support
          </NavLink>
        )}

        <NavLink
          underline="none"
          href="https://docs.nhost.io"
          className="mr-2 rounded-md px-2.5 py-1.5 text-foreground text-sm hover:bg-accent motion-safe:transition-colors"
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
