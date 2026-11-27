import { useRouter } from 'next/router';
import { describeCronSchedule } from '@/features/orgs/projects/events/common/components/CronScheduleInput/cron-schedule';
import CronJobListItem from '@/features/orgs/projects/events/cron-jobs/components/CronJobListItem';
import {
  cronJobsPath,
  webhookJobPath,
} from '@/features/orgs/projects/events/cron-jobs/cron-jobs-path';
import type { CronTrigger } from '@/utils/hasura-api/generated/schemas';

interface CronTriggerListItemProps {
  cronTrigger: CronTrigger;
  onNavigate: VoidFunction;
}

export default function CronTriggerListItem({
  cronTrigger,
  onNavigate,
}: CronTriggerListItemProps) {
  const { orgSlug, appSubdomain, cronTriggerSlug } = useRouter().query;

  return (
    <CronJobListItem
      name={cronTrigger.name}
      schedule={describeCronSchedule(cronTrigger.schedule)}
      href={webhookJobPath(
        cronJobsPath(orgSlug, appSubdomain),
        cronTrigger.name,
      )}
      selected={cronTrigger.name === cronTriggerSlug}
      onNavigate={onNavigate}
    />
  );
}
