import { ContactUs } from '@/components/common/ContactUs';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Button } from '@/components/ui/v2/Button';
import { Dropdown } from '@/components/ui/v2/Dropdown';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useInterval } from '@/hooks/useInterval';
import { getRelativeDateByApplicationState } from '@/utils/helpers';
import { useState } from 'react';

export interface AppLoaderProps {
  /**
   * The parent component has the ability to start/stop the counter.
   */
  startLoader: boolean;
  /**
   * Determines whether the loader should display information about provisioning or unpausing an application.
   */
  unpause?: boolean;
  /**
   * Enter an arbitrary date in which to start the counter at.
   */
  date?: string;
  /**
   * Is restoring from a backup
   */
  restoring?: boolean;
}

export default function AppLoader({
  startLoader,
  unpause,
  date,
  restoring,
}: AppLoaderProps) {
  const { currentProject } = useCurrentWorkspaceAndProject();

  let timeElapsedSinceEventCreation: number;

  if (date) {
    timeElapsedSinceEventCreation = getRelativeDateByApplicationState(date);
  } else if (unpause) {
    timeElapsedSinceEventCreation = getRelativeDateByApplicationState(
      currentProject.appStates[0].createdAt,
    );
  } else {
    timeElapsedSinceEventCreation = getRelativeDateByApplicationState(
      currentProject.createdAt,
    );
  }

  const [timeElapsed, setTimeElapsed] = useState(timeElapsedSinceEventCreation);

  // Would be also valuable to check the appCreatedTime so this doesn't ever appear if not created under a time limit. @GC
  useInterval(
    () => {
      setTimeElapsed(timeElapsed + 1);
    },
    startLoader ? 1000 : null,
  );

  return (
    <div className="grid grid-flow-row gap-2">
      <div className="grid grid-flow-row gap-1">
        <Text variant="h3" component="h1">
          {restoring && `Restoring ${currentProject.name} from backup`}
          {!restoring && unpause && `Unpausing ${currentProject.name}`}
          {!restoring && !unpause && `Provisioning ${currentProject.name}`}
        </Text>
        <Text>This normally takes around 2 minutes</Text>
      </div>

      {timeElapsed <= 5 && (
        <Text color="disabled">Setting up authentication</Text>
      )}
      {timeElapsed > 5 && timeElapsed <= 10 && (
        <Text color="disabled">Setting up file storage</Text>
      )}
      {timeElapsed > 10 && timeElapsed <= 15 && (
        <Text color="disabled">Setting up database</Text>
      )}
      {timeElapsed > 15 && timeElapsed <= 20 && (
        <Text color="disabled">Setting up Hasura</Text>
      )}
      {timeElapsed > 20 && <Text color="disabled">Doing final cleanup</Text>}
      <ActivityIndicator className="mx-auto" />

      {timeElapsed > 180 && (
        <Dropdown.Root className="mx-auto flex flex-col">
          <Dropdown.Trigger
            className="mx-auto flex font-medium"
            hideChevron
            asChild
          >
            <Button variant="borderless">Contact Support</Button>
          </Dropdown.Trigger>

          <Dropdown.Content
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            transformOrigin={{ vertical: 'top', horizontal: 'center' }}
          >
            <ContactUs />
          </Dropdown.Content>
        </Dropdown.Root>
      )}
    </div>
  );
}
