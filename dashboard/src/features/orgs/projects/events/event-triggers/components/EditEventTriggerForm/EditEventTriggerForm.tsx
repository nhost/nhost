import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import {
  BaseEventTriggerForm,
  type BaseEventTriggerFormTriggerProps,
} from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm';
import type {
  BaseEventTriggerFormInitialData,
  BaseEventTriggerFormValues,
} from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import { useCreateEventTriggerMutation } from '@/features/orgs/projects/events/event-triggers/hooks/useCreateEventTriggerMutation';
import type { EventTriggerViewModel } from '@/features/orgs/projects/events/event-triggers/types';
import { buildEventTriggerDTO } from '@/features/orgs/projects/events/event-triggers/utils/buildEventTriggerDTO';
import parseEventTriggerFormInitialData from '@/features/orgs/projects/events/event-triggers/utils/parseEventTriggerFormInitialData/parseEventTriggerFormInitialData';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useEffect, useState, type ReactNode } from 'react';

export interface EditEventTriggerFormProps {
  eventTrigger: EventTriggerViewModel;
  trigger: (props: BaseEventTriggerFormTriggerProps) => ReactNode;
  onSubmit: (data: BaseEventTriggerFormValues) => void;
}

export default function EditEventTriggerForm({
  eventTrigger,
  trigger,
  onSubmit,
}: EditEventTriggerFormProps) {
  const [initialData, setInitialData] =
    useState<BaseEventTriggerFormInitialData>(() =>
      parseEventTriggerFormInitialData(eventTrigger),
    );

  useEffect(() => {
    setInitialData(parseEventTriggerFormInitialData(eventTrigger));
  }, [eventTrigger]);

  const { mutateAsync: createEventTrigger } = useCreateEventTriggerMutation();
  const { data: resourceVersion } = useGetMetadataResourceVersion();

  const handleSubmit = async (data: BaseEventTriggerFormValues) => {
    const eventTriggerDTO = buildEventTriggerDTO({
      formValues: data,
      isEdit: true,
    });
    await execPromiseWithErrorToast(
      async () => {
        await createEventTrigger({
          args: eventTriggerDTO,
          resourceVersion: resourceVersion ?? undefined,
        });
        setInitialData(data);
        onSubmit?.(data);
      },
      {
        loadingMessage: 'Editing event trigger...',
        successMessage: 'The event trigger has been edited successfully.',
        errorMessage:
          'An error occurred while editing the event trigger. Please try again.',
      },
    );
  };

  return (
    <BaseEventTriggerForm
      trigger={trigger}
      onSubmit={handleSubmit}
      isEditing
      initialData={initialData}
      titleText="Edit Event Trigger"
      descriptionText="Enter the details to edit your event trigger. Click Save when you're done."
      submitButtonText="Save"
    />
  );
}
