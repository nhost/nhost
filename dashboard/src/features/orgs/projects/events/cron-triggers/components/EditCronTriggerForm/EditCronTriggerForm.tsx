import type { BaseCronTriggerFormTriggerProps } from '@/features/orgs/projects/events/cron-triggers/components/BaseCronTriggerForm/BaseCronTriggerFormTypes';
import type { CronTrigger } from '@/utils/hasura-api/generated/schemas';
import type { ReactNode } from 'react';

export interface EditCronTriggerFormProps {
  cronTrigger: CronTrigger;
  trigger: (props: BaseCronTriggerFormTriggerProps) => ReactNode;
}

export default function EditCronTriggerForm() {
  return <div />;
}
