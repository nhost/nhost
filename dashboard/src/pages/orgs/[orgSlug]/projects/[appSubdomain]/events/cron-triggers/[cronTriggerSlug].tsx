import { useRouter } from 'next/router';
import { type ReactElement, useState } from 'react';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { CronTriggersBrowserSidebar } from '@/features/orgs/projects/events/cron-triggers/components/CronTriggersBrowserSidebar';
import { CronTriggerView } from '@/features/orgs/projects/events/cron-triggers/components/CronTriggerView';
import type { CronTriggerEventsSection } from '@/features/orgs/projects/events/cron-triggers/components/CronTriggerEventsDataTable/cronTriggerEventsDataTableColumns';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function CronTriggerDetailsPage() {
  const router = useRouter();
  const { cronTriggerSlug } = router.query;
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const [tab, setTab] = useState('overview');
  const [eventLogsSection, setEventLogsSection] =
    useState<CronTriggerEventsSection>('processed');

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  return (
    <RetryableErrorBoundary>
      <CronTriggerView
        key={cronTriggerSlug as string}
        tab={tab}
        onTabChange={setTab}
        eventLogsSection={eventLogsSection}
        onEventLogsSectionChange={setEventLogsSection}
      />
    </RetryableErrorBoundary>
  );
}

CronTriggerDetailsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <OrgLayout
      mainContainerProps={{
        className: 'flex h-full',
      }}
    >
      <CronTriggersBrowserSidebar className="w-full max-w-sidebar" />

      <div className="box flex w-full flex-auto flex-col overflow-x-hidden">
        {page}
      </div>
    </OrgLayout>
  );
};
