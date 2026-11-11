import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { DEFAULT_PRELOADED_LIBRARIES } from '@/features/orgs/projects/database/extensions/constants';
import { usePreloadedLibrariesQuery } from '@/features/orgs/projects/database/extensions/hooks/usePreloadedLibrariesQuery';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  useGetConfiguredPreloadLibrariesQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { ApplicationStatus } from '@/types/application';

type PreloadLibraryStatus =
  | 'loading'
  | 'error'
  | 'preloaded'
  | 'not-configured'
  /**
   * Configured, waiting for the platform to restart PostgreSQL.
   */
  | 'restarting'
  /**
   * Configured, but deploying the project failed before PostgreSQL loaded it.
   */
  | 'restart-failed'
  /**
   * Configured locally, waiting for the user to run `nhost up`.
   */
  | 'pending-local-restart';

const RESTART_CHECK_INTERVAL_MS = 10_000;

interface PreloadLibraryStatusInput {
  library: string;
  runningLibraries?: string[];
  isLoadingRunningLibraries: boolean;
  configuredLibraries: string[] | null;
  hasSettingsError: boolean;
  isPlatform: boolean;
  appState: ApplicationStatus;
}

function getPreloadLibraryStatus({
  library,
  runningLibraries,
  isLoadingRunningLibraries,
  configuredLibraries,
  hasSettingsError,
  isPlatform,
  appState,
}: PreloadLibraryStatusInput): PreloadLibraryStatus {
  if (runningLibraries?.includes(library)) {
    return 'preloaded';
  }

  if (hasSettingsError) {
    return 'error';
  }

  if (isLoadingRunningLibraries || configuredLibraries === null) {
    return 'loading';
  }

  if (!configuredLibraries.includes(library)) {
    return 'not-configured';
  }

  if (!isPlatform) {
    return 'pending-local-restart';
  }

  if (appState === ApplicationStatus.Errored) {
    return 'restart-failed';
  }

  return 'restarting';
}

/**
 * Tracks whether PostgreSQL preloads `library` and adds it to the project's
 * `postgres.settings.sharedPreloadLibraries`.
 */
export default function usePreloadLibrary(
  library: string,
  dataSource: string,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { project } = useProject();
  const { state, project: projectWithState } = useAppState();
  const queryClient = useQueryClient();
  const clientOptions = isPlatform ? {} : { client: localMimirClient };
  const configured = useGetConfiguredPreloadLibrariesQuery({
    variables: { appId: project?.id },
    skip: !enabled || !project?.id,
    ...clientOptions,
  });
  const [updateConfig, { loading: isAdding }] =
    useUpdateConfigMutation(clientOptions);
  const running = usePreloadedLibrariesQuery(dataSource);

  // An unset list means the defaults; an empty list means no libraries.
  const configuredLibraries: string[] | null = configured.data
    ? (configured.data.config?.postgres.settings?.sharedPreloadLibraries ??
      DEFAULT_PRELOADED_LIBRARIES)
    : null;

  const status = getPreloadLibraryStatus({
    library,
    runningLibraries: running.data,
    isLoadingRunningLibraries: running.isLoading,
    configuredLibraries,
    hasSettingsError: Boolean(configured.error),
    isPlatform,
    appState: state,
  });

  const isWaitingForLiveProject =
    status === 'restarting' && state === ApplicationStatus.Live;
  const { refetch: refetchRunning } = running;

  // Checks the database only while the project reports it is live; the check
  // fails while PostgreSQL restarts.
  useEffect(() => {
    if (!isWaitingForLiveProject) {
      return undefined;
    }

    refetchRunning();
    const interval = setInterval(refetchRunning, RESTART_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isWaitingForLiveProject, refetchRunning]);

  async function addLibrary() {
    // The mutation replaces the whole list, so it must start from the
    // configured one.
    if (configuredLibraries === null) {
      throw new Error('The project settings have not loaded yet.');
    }

    await updateConfig({
      variables: {
        appId: project?.id,
        config: {
          postgres: {
            settings: {
              sharedPreloadLibraries: [
                ...configuredLibraries.filter((name) => name !== library),
                library,
              ],
            },
          },
        },
      },
    });
    await configured.refetch();

    if (isPlatform && project?.subdomain) {
      await queryClient.invalidateQueries({
        queryKey: ['projectWithState', project.subdomain],
      });
    }
  }

  return {
    status,
    isAdding,
    isChecking: running.isFetching,
    error: configured.error ?? null,
    restartError:
      status === 'restart-failed'
        ? (projectWithState?.appStates?.[0]?.message ?? null)
        : null,
    addLibrary,
    checkAgain: () => refetchRunning(),
    reloadSettings: () => configured.refetch(),
  };
}

export type PreloadLibrary = ReturnType<typeof usePreloadLibrary>;
