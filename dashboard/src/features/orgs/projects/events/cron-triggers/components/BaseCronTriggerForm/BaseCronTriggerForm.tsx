import type {
  BaseCronTriggerFormInitialData,
  BaseCronTriggerFormTriggerProps,
  BaseCronTriggerFormValues,
} from './BaseCronTriggerFormTypes';

import type { ReactNode } from 'react';

export interface BaseCronTriggerFormProps {
  initialData?: BaseCronTriggerFormInitialData;
  trigger: (props: BaseCronTriggerFormTriggerProps) => ReactNode;
  onSubmit: (data: BaseCronTriggerFormValues) => void | Promise<void>;
  isEditing?: boolean;
  submitButtonText: string;
  titleText: string;
  descriptionText: string;
}

export default function BaseCronTriggerForm() {
  return <div>BaseCronTriggerForm</div>;
}
