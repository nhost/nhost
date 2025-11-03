import { BaseEventTriggerForm } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm';
import type {
  BaseEventTriggerFormInitialData,
  BaseEventTriggerFormValues,
} from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';

export interface EditEventTriggerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: BaseEventTriggerFormValues) => void;
  initialData?: BaseEventTriggerFormInitialData;
}

export default function EditEventTriggerForm({
  open,
  onOpenChange,
  onSubmit,
  initialData,
}: EditEventTriggerFormProps) {
  return (
    <BaseEventTriggerForm
      open={open}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      initialData={initialData}
      titleText="Edit Event Trigger"
      descriptionText="Enter the details to edit your event trigger. Click Save when you're done."
      submitButtonText="Save"
    />
  );
}
