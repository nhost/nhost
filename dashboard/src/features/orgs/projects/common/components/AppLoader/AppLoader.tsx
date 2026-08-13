import Link from 'next/link';
import { useEffect, useState } from 'react';
import CopyToClipboardButton from '@/components/presentational/CopyToClipboardButton/CopyToClipboardButton';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { Spinner } from '@/components/ui/v3/spinner';
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
        <h1 className="font-medium text-lg">
          {restoring && `Restoring ${project?.name} from backup`}
          {!restoring && unpause && `Unpausing ${project?.name}`}
          {!restoring && !unpause && `Provisioning ${project?.name}`}
        </h1>
        <p className="text-sm">This normally takes around 2 minutes</p>
      </div>

      {project && (
        <div className="my-2 grid grid-cols-2 gap-3 rounded-lg border border-border bg-background p-3 text-left">
          <div className="flex flex-col gap-1">
            <p className="text-disabled text-xs">Subdomain</p>
            <div className="flex items-center justify-between rounded bg-muted px-2 py-1 font-mono text-sm">
              <span className="truncate">{project.subdomain}</span>
              <CopyToClipboardButton
                textToCopy={project.subdomain}
                title="Subdomain"
              />
            </div>
          </div>
          {project.region.name && (
            <div className="flex flex-col gap-1">
              <p className="text-disabled text-xs">Region</p>
              <div className="flex items-center justify-between rounded bg-muted px-2 py-1 font-mono text-sm">
                <span className="truncate">{project.region.name}</span>
                <CopyToClipboardButton
                  textToCopy={project.region.name}
                  title="Region"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {timeElapsed <= 5 && (
        <p className="text-disabled text-sm">Setting up authentication</p>
      )}
      {timeElapsed > 5 && timeElapsed <= 10 && (
        <p className="text-disabled text-sm">Setting up file storage</p>
      )}
      {timeElapsed > 10 && timeElapsed <= 15 && (
        <p className="text-disabled text-sm">Setting up database</p>
      )}
      {timeElapsed > 15 && timeElapsed <= 20 && (
        <p className="text-disabled text-sm">Setting up Hasura</p>
      )}
      {timeElapsed > 20 && (
        <p className="text-disabled text-sm">Doing final cleanup</p>
      )}
      <Spinner size="xs" />

      {timeElapsed > 180 && (
        <Link
          className="font-semibold text-primary underline underline-offset-2"
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
