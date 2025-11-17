import type { CronTrigger } from '@/utils/hasura-api/generated/schemas';
import type { ReactNode } from 'react';
import type { BaseCronTriggerFormTriggerProps } from '../BaseCronTriggerForm/BaseCronTriggerFormTypes';

export interface EditCronTriggerFormProps {
  cronTrigger: CronTrigger;
  trigger: (props: BaseCronTriggerFormTriggerProps) => ReactNode;
}

export default function EditCronTriggerForm({
  cronTrigger,
  trigger,
}: EditCronTriggerFormProps) {
  return <div />;
}
