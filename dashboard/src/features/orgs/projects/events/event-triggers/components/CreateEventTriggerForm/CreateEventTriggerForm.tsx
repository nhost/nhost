import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import {
  BaseEventTriggerForm,
  type BaseEventTriggerFormTriggerProps,
} from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm';
import type { BaseEventTriggerFormValues } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import { useCreateEventTriggerMutation } from '@/features/orgs/projects/events/event-triggers/hooks/useCreateEventTriggerMutation';
import { buildEventTriggerDTO } from '@/features/orgs/projects/events/event-triggers/utils/buildEventTriggerDTO';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { ReactNode } from 'react';

export interface CreateEventTriggerFormProps {
  trigger: (props: BaseEventTriggerFormTriggerProps) => ReactNode;
  onSubmit: (data: BaseEventTriggerFormValues) => void;
}

export default function CreateEventTriggerForm({
  trigger,
  onSubmit,
}: CreateEventTriggerFormProps) {
  const { mutateAsync: createEventTrigger } = useCreateEventTriggerMutation();
  const { data: resourceVersion } = useGetMetadataResourceVersion();

  const handleSubmit = async (data: BaseEventTriggerFormValues) => {
    const eventTriggerDTO = buildEventTriggerDTO({ formValues: data });
    await execPromiseWithErrorToast(
      async () => {
        await createEventTrigger({
          args: eventTriggerDTO,
          resourceVersion: resourceVersion ?? undefined,
        });
        onSubmit?.(data);
      },
      {
        loadingMessage: 'Creating event trigger...',
        successMessage: 'The event trigger has been created successfully.',
        errorMessage:
          'An error occurred while creating the event trigger. Please try again.',
      },
    );
  };

  return (
    <BaseEventTriggerForm
      trigger={trigger}
      onSubmit={handleSubmit}
      titleText="Create a New Event Trigger"
      descriptionText="Enter the details to create your event trigger. Click Create when you're done."
      submitButtonText="Create"
    />
  );
}
