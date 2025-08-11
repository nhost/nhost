import { useDialog } from '@/components/common/DialogProvider';
import { FormActivityIndicator } from '@/components/form/FormActivityIndicator';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Backdrop } from '@/components/ui/v2/Backdrop';
import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { IconButton } from '@/components/ui/v2/IconButton';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { Text } from '@/components/ui/v2/Text';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { twMerge } from 'tailwind-merge';

const CreateEventTriggerForm = dynamic(
  () =>
    import(
      '@/features/orgs/projects/events/components/CreateEventTriggerForm/CreateEventTriggerForm'
    ),
  {
    ssr: false,
    loading: () => <FormActivityIndicator />,
  },
);

export interface EventsBrowserSidebarProps extends Omit<BoxProps, 'children'> {
  /**
   * Function to be called when a sidebar item is clicked.
   */
  onSidebarItemClick?: (tablePath?: string) => void;
}

function EventsBrowserSidebarContent({
  onSidebarItemClick,
}: Pick<EventsBrowserSidebarProps, 'onSidebarItemClick'>) {
  const queryClient = useQueryClient();
  const { openDrawer, openAlertDialog } = useDialog();
  const { project, loading } = useProject();
  const isGitHubConnected = !!project?.githubRepository;

  const router = useRouter();

  const {
    query: { orgSlug, appSubdomain, remoteSchemaSlug },
  } = router;

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading events..."
        className="justify-center"
      />
    );
  }

  return (
    <Box className="flex h-full flex-col px-2">
      <Box className="flex flex-row gap-2">
        <Text>Event Triggers</Text>
        <Button
          variant="borderless"
          endIcon={<PlusIcon />}
          className="mt-1 w-full justify-between px-2"
          onClick={() => {
            openDrawer({
              title: 'Create a New Event Trigger',
              component: <CreateEventTriggerForm />,
            });
            onSidebarItemClick();
          }}
          disabled={isGitHubConnected}
        />
      </Box>
    </Box>
  );
}

export default function EventsBrowserSidebar({
  className,
  onSidebarItemClick,
  ...props
}: EventsBrowserSidebarProps) {
  const isPlatform = useIsPlatform();
  const { project } = useProject();

  const [expanded, setExpanded] = useState(false);

  function toggleExpanded() {
    setExpanded(!expanded);
  }

  function handleSidebarItemClick(tablePath?: string) {
    if (onSidebarItemClick && tablePath) {
      onSidebarItemClick(tablePath);
    }

    setExpanded(false);
  }

  function closeSidebarWhenEscapeIsPressed(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      setExpanded(false);
    }
  }

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', closeSidebarWhenEscapeIsPressed);
    }

    return () =>
      document.removeEventListener('keydown', closeSidebarWhenEscapeIsPressed);
  }, []);

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return null;
  }

  return (
    <>
      <Backdrop
        open={expanded}
        className="absolute bottom-0 left-0 right-0 top-0 z-[34] sm:hidden"
        role="button"
        tabIndex={-1}
        onClick={() => setExpanded(false)}
        aria-label="Close sidebar overlay"
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') {
            return;
          }

          setExpanded(false);
        }}
      />

      <Box
        component="aside"
        className={twMerge(
          'absolute top-0 z-[35] h-full w-full overflow-auto border-r-1 pb-17 pt-2 motion-safe:transition-transform sm:relative sm:z-0 sm:h-full sm:pb-0 sm:pt-2.5 sm:transition-none',
          expanded ? 'translate-x-0' : '-translate-x-full sm:translate-x-0',
          className,
        )}
        {...props}
      >
        <RetryableErrorBoundary>
          <EventsBrowserSidebarContent
            onSidebarItemClick={handleSidebarItemClick}
          />
        </RetryableErrorBoundary>
      </Box>

      <IconButton
        className="absolute bottom-4 left-4 z-[38] h-11 w-11 rounded-full md:hidden"
        onClick={toggleExpanded}
        aria-label="Toggle sidebar"
      >
        <Image
          width={16}
          height={16}
          src="/assets/table.svg"
          alt="A monochrome table"
        />
      </IconButton>
    </>
  );
}
