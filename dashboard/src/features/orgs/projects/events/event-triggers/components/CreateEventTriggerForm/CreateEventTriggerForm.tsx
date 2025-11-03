import { BaseEventTriggerForm } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm';
import type { BaseEventTriggerFormValues } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';

export interface CreateEventTriggerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: BaseEventTriggerFormValues) => void;
}

export default function CreateEventTriggerForm({
  open,
  onOpenChange,
  onSubmit,
}: CreateEventTriggerFormProps) {
  return (
    <BaseEventTriggerForm
      open={open}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      titleText="Create a New Event Trigger"
      descriptionText="Enter the details to create your event trigger. Click Create when you're done."
      submitButtonText="Create"
    />
  );
}
