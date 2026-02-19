import { useRouter } from 'next/router';
import type { PropsWithChildren } from 'react';
import { ApplicationPaused } from '@/features/orgs/projects/common/components/ApplicationPaused';
import { ApplicationPausedBanner } from '@/features/orgs/projects/common/components/ApplicationPausedBanner';

const baseProjectPageRoute = '/orgs/[orgSlug]/projects/[appSubdomain]/';
const blockedPausedProjectPages = [
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

function PausedProjectContent({ children }: PropsWithChildren) {
  const { route } = useRouter();

  const isOnOverviewPage = route === '/orgs/[orgSlug]/projects/[appSubdomain]';

  if (isOnOverviewPage) {
    return (
      <>
        <div className="mx-auto mt-5 flex max-w-7xl p-4 pb-0">
          <ApplicationPausedBanner
            alertClassName="flex-row"
            textContainerClassName="flex flex-col items-center justify-center text-left"
            wakeUpButtonClassName="w-fit self-center"
          />
        </div>
        {children}
      </>
    );
  }

  // block these pages when the project is paused
  if (blockedPausedProjectPages.includes(route)) {
    return <ApplicationPaused />;
  }

  return children;
}

export default PausedProjectContent;
