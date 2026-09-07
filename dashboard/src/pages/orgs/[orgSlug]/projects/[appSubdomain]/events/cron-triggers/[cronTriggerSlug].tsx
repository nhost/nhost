import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { CronTriggersBrowserSidebar } from '@/features/orgs/projects/events/cron-triggers/components/CronTriggersBrowserSidebar';
import { CronTriggerView } from '@/features/orgs/projects/events/cron-triggers/components/CronTriggerView';
import { getEventsLayout } from '@/features/orgs/projects/events/layout';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function CronTriggerDetailsPage() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const router = useRouter();
  const { cronTriggerSlug } = router.query;

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  return (
    <RetryableErrorBoundary>
      <CronTriggerView key={cronTriggerSlug as string} />
    </RetryableErrorBoundary>
  );
}

CronTriggerDetailsPage.getLayout = function getLayout(page: ReactElement) {
  return getEventsLayout(page, {
    sidebar: <CronTriggersBrowserSidebar />,
    contentClassName:
      'box flex w-full flex-auto flex-col overflow-x-hidden overflow-y-hidden',
  });
};
