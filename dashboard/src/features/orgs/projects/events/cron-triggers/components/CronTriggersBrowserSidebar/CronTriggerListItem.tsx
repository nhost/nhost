import { useRouter } from 'next/router';
import { useRef, useState } from 'react';
import { describeCronSchedule } from '@/features/orgs/projects/events/common/components/CronScheduleInput/cron-schedule';
import CronJobListItem from '@/features/orgs/projects/events/cron-jobs/components/CronJobListItem';
import {
  cronJobsPath,
  webhookJobPath,
} from '@/features/orgs/projects/events/cron-jobs/cron-jobs-path';
import type { BaseCronTriggerFormTriggerProps } from '@/features/orgs/projects/events/cron-triggers/components/BaseCronTriggerForm';
import { DeleteCronTriggerDialog } from '@/features/orgs/projects/events/cron-triggers/components/DeleteCronTriggerDialog';
import { EditCronTriggerForm } from '@/features/orgs/projects/events/cron-triggers/components/EditCronTriggerForm';
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
  const editTriggerRef = useRef<BaseCronTriggerFormTriggerProps | null>(null);
  const [deleting, setDeleting] = useState(false);

  return (
    <>
      <CronJobListItem
        name={cronTrigger.name}
        schedule={describeCronSchedule(cronTrigger.schedule)}
        href={webhookJobPath(
          cronJobsPath(orgSlug, appSubdomain),
          cronTrigger.name,
        )}
        selected={cronTrigger.name === cronTriggerSlug}
        onNavigate={onNavigate}
        onEdit={() => editTriggerRef.current?.open()}
        onDelete={() => setDeleting(true)}
      />
      <EditCronTriggerForm
        cronTrigger={cronTrigger}
        trigger={(controls) => {
          editTriggerRef.current = controls;
          return null;
        }}
      />
      <DeleteCronTriggerDialog
        open={deleting}
        setOpen={setDeleting}
        cronTriggerToDelete={cronTrigger.name}
      />
    </>
  );
}
