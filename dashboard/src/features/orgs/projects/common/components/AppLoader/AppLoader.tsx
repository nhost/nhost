import { useEffect, useState } from 'react';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useInterval } from '@/hooks/useInterval';
import { getRelativeDateByApplicationState } from '@/utils/helpers';

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
  const { project, loading } = useProject();
  const [timeElapsed, setTimeElapsed] = useState<number>(0);

  useEffect(() => {
    if (!project || loading) {
      return;
    }

    let timeElapsedSinceEventCreation: number;

    if (date) {
      timeElapsedSinceEventCreation = getRelativeDateByApplicationState(date);
    } else if (unpause) {
      timeElapsedSinceEventCreation = getRelativeDateByApplicationState(
        project.appStates[0].createdAt,
      );
    } else {
      timeElapsedSinceEventCreation = getRelativeDateByApplicationState(
        project.createdAt,
      );
    }

    setTimeElapsed(timeElapsedSinceEventCreation);
  }, [project, date, unpause, loading]);

  useInterval(
    () => {
      setTimeElapsed(timeElapsed + 1);
    },
    startLoader ? 1000 : null,
  );

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="grid grid-flow-row gap-2">
      <div className="grid grid-flow-row gap-1">
        <Text variant="h3" component="h1">
          {restoring && `Restoring ${project?.name} from backup`}
          {!restoring && unpause && `Unpausing ${project?.name}`}
          {!restoring && !unpause && `Provisioning ${project?.name}`}
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
        <Link
          className="font-semibold underline underline-offset-2"
          href="/support"
          target="_blank"
          rel="noopener noreferrer"
        >
          Contact Support
        </Link>
      )}
    </div>
  );
}
