import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { BaseEventTriggerForm } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm';
import type {
  BaseEventTriggerFormInitialData,
  BaseEventTriggerFormValues,
} from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import { useCreateEventTriggerMutation } from '@/features/orgs/projects/events/event-triggers/hooks/useCreateEventTriggerMutation';
import { buildEventTriggerDTO } from '@/features/orgs/projects/events/event-triggers/utils/buildEventTriggerDTO';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

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
      open={open}
      onOpenChange={onOpenChange}
      onSubmit={handleSubmit}
      isEditing
      initialData={initialData}
      titleText="Edit Event Trigger"
      descriptionText="Enter the details to edit your event trigger. Click Save when you're done."
      submitButtonText="Save"
    />
  );
}
