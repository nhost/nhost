import { ContactUs } from '@/components/common/ContactUs';
import { useDialog } from '@/components/common/DialogProvider';
import { NavLink } from '@/components/common/NavLink';
import { AccountMenu } from '@/components/layout/AccountMenu';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { LocalAccountMenu } from '@/components/layout/LocalAccountMenu';
import { MobileNav } from '@/components/layout/MobileNav';
import { Logo } from '@/components/presentational/Logo';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Chip } from '@/components/ui/v2/Chip';
import { Dropdown } from '@/components/ui/v2/Dropdown';
import { GraphiteIcon } from '@/components/ui/v2/icons/GraphiteIcon';
import { DevAssistant } from '@/features/ai/DevAssistant';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { ApplicationStatus } from '@/types/application';
import { getToastStyleProps } from '@/utils/constants/settings';
import { useRouter } from 'next/router';
import type { DetailedHTMLProps, HTMLProps, PropsWithoutRef } from 'react';
import { useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { twMerge } from 'tailwind-merge';

export interface HeaderProps
  extends PropsWithoutRef<
    DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>
  > {}

export default function Header({ className, ...props }: HeaderProps) {
  const router = useRouter();

  const isPlatform = useIsPlatform();

  const { openDrawer } = useDialog();

  const { currentProject, refetch: refetchProject } =
    useCurrentWorkspaceAndProject();

  const isProjectUpdating =
    currentProject?.appStates[0]?.stateId === ApplicationStatus.Updating;

  // Poll for project updates
  useEffect(() => {
    if (!isProjectUpdating) {
      return () => {};
    }

    const interval = setInterval(async () => {
      await refetchProject();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [isProjectUpdating, refetchProject]);

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
        'z-40 grid w-full transform-gpu grid-flow-col items-center justify-between gap-2 border-b-1 px-4 py-3',
        className,
      )}
      sx={{ backgroundColor: 'background.paper' }}
      {...props}
    >
      <div className="grid grid-flow-col items-center gap-3">
        <NavLink href="/" className="w-12">
          <Logo className="mx-auto cursor-pointer" />
        </NavLink>

        {(router.query.workspaceSlug || router.query.appSlug) && (
          <Breadcrumbs aria-label="Workspace breadcrumbs" />
        )}

        {isProjectUpdating && (
          <Chip size="small" label="Updating" color="warning" />
        )}
      </div>

      <div className="hidden grid-flow-col items-center gap-2 sm:grid">
        <Button className="rounded-full" onClick={openDevAssistant}>
          <GraphiteIcon />
        </Button>

        {isPlatform && (
          <Dropdown.Root>
            <Dropdown.Trigger
              hideChevron
              className="rounded-md px-2.5 py-1.5 text-sm motion-safe:transition-colors"
            >
              Contact us
            </Dropdown.Trigger>

            <Dropdown.Content
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
              <ContactUs className="max-w-md" />
            </Dropdown.Content>
          </Dropdown.Root>
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
