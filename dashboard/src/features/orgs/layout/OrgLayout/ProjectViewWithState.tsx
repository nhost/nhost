import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { type PropsWithChildren, useEffect, useMemo } from 'react';
import { Alert } from '@/components/ui/v2/Alert';
import { ApplicationProvisioning } from '@/features/orgs/projects/common/components/ApplicationProvisioning';
import { ApplicationUnknown } from '@/features/orgs/projects/common/components/ApplicationUnknown';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { useProjectRedirectWhenReady } from '@/features/orgs/projects/common/hooks/useProjectRedirectWhenReady';
import { isNotEmptyValue } from '@/lib/utils';
import { ApplicationStatus } from '@/types/application';
import ProjectStateOverlay, {
  type ProjectStateOverlayVariant,
} from './ProjectStateOverlay';

const baseProjectPageRoute = '/orgs/[orgSlug]/projects/[appSubdomain]/';
const overlayPages = [
  'database',
  'database/browser/[dataSourceSlug]',
  'graphql',
  'graphql/remote-schemas',
  'graphql/remote-schemas/[remoteSchemaSlug]',
  'graphql/metadata',
  'events/event-triggers',
  'events/event-triggers/[eventTriggerSlug]',
  'events/cron-triggers',
  'events/cron-triggers/[cronTriggerSlug]',
  'events/one-offs',
  'hasura',
  'auth/users',
  'auth/oauth2-clients',
  'storage',
  'ai/auto-embeddings',
  'ai/assistants',
  'ai/file-stores',
  'metrics',
].map((page) => baseProjectPageRoute.concat(page));

function PollingProjectContent({ children }: PropsWithChildren) {
  useProjectRedirectWhenReady({ pollInterval: 2000 });
  return children;
}

function ProjectViewWithState({ children }: PropsWithChildren) {
  const {
    query: { appSubdomain },
    route,
  } = useRouter();

  const queryClient = useQueryClient();

  useEffect(() => {
    return () => {
      queryClient.clear();
    };
  }, [queryClient]);

  const { state } = useAppState();

  const isOnOverviewPage = route === '/orgs/[orgSlug]/projects/[appSubdomain]';
  const showOverlay = overlayPages.includes(route);

  const projectPageContent = useMemo(() => {
    if (!appSubdomain || state === undefined) {
      return children;
    }

    const overlayVariantByState: Record<string, ProjectStateOverlayVariant> = {
      [ApplicationStatus.Paused]: 'paused',
      [ApplicationStatus.Pausing]: 'pausing',
      [ApplicationStatus.Unpausing]: 'unpausing',
      [ApplicationStatus.Restoring]: 'unpausing',
    };

    const overlayVariant = overlayVariantByState[state];

    switch (state) {
      case ApplicationStatus.Empty: {
        if (typeof window !== 'undefined') {
          const newProjectSubdomain = sessionStorage.getItem(
            'newProjectSubdomain',
          );
          if (
            isNotEmptyValue(newProjectSubdomain) &&
            newProjectSubdomain === appSubdomain
          ) {
            return <ApplicationProvisioning />;
          }
        }

        return null;
      }
      case ApplicationStatus.Provisioning: {
        sessionStorage.removeItem('newProjectSubdomain');
        return <ApplicationProvisioning />;
      }
      case ApplicationStatus.Errored:
        if (isOnOverviewPage) {
          return (
            <>
              <div className="w-full p-4">
                <Alert severity="error" className="mx-auto max-w-7xl">
                  Error deploying the project most likely due to invalid
                  configuration. Please review your project&apos;s configuration
                  and logs for more information.
                </Alert>
              </div>
              {children}
            </>
          );
        }
        return children;
      case ApplicationStatus.Pausing:
      case ApplicationStatus.Paused:
        return (
          <>
            {showOverlay && overlayVariant && (
              <ProjectStateOverlay variant={overlayVariant} />
            )}
            {children}
          </>
        );
      case ApplicationStatus.Unpausing:
      case ApplicationStatus.Restoring:
        return (
          <PollingProjectContent>
            {showOverlay && overlayVariant && (
              <ProjectStateOverlay variant={overlayVariant} />
            )}
            {children}
          </PollingProjectContent>
        );
      case ApplicationStatus.Updating:
      case ApplicationStatus.Live:
      case ApplicationStatus.Migrating:
        return children;
      default:
        return <ApplicationUnknown />;
    }
  }, [state, children, appSubdomain, isOnOverviewPage, showOverlay]);

  return projectPageContent;
}

export default ProjectViewWithState;
